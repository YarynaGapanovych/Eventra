import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventSource,
  GuestResponse,
  TaskBoardStatus,
  type Prisma,
} from '../generated/prisma/client';
import { GoogleCalendarWriteService, toGoogleWriteEvent } from '../integrations/google-calendar-write.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEventInput,
  Event,
  ScheduleTaskInput,
  UpdateEventInput,
} from './event.types';
import {
  assertRange,
  calendarDataFromTask,
  calendarScalarData,
  EVENT_DETAIL_INCLUDE,
  expandRecurringEvent,
  expansionWindow,
  guestCreateData,
  nestedGuestReminderCreate,
  parseIsoDate,
  parseMasterEventId,
  parseRange,
  reminderCreateData,
  TASK_DETAIL_INCLUDE,
  toEventDto,
  type EventWithDetails,
} from '../calendar/calendar-fields';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleWrite: GoogleCalendarWriteService,
  ) {}

  async listForUser(userId: string): Promise<Event[]> {
    const [settings, integration] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.googleCalendarIntegration.findUnique({ where: { userId } }),
    ]);
    const showPastDone = settings?.showPastDoneTaskEvents ?? true;
    const now = new Date();
    const window = expansionWindow(integration);

    const rows = await this.prisma.event.findMany({
      where: {
        userId,
        ...(showPastDone
          ? {}
          : {
              NOT: {
                AND: [
                  { start: { lt: now } },
                  { task: { is: { status: TaskBoardStatus.done } } },
                ],
              },
            }),
      },
      include: EVENT_DETAIL_INCLUDE,
      orderBy: { start: 'asc' },
    });

    return rows
      .flatMap((event) => expandRecurringEvent(event, window.start, window.end))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  async createForUser(userId: string, input: CreateEventInput): Promise<Event> {
    const { start, end } = parseRange(input.start, input.end);
    const created = await this.prisma.event.create({
      data: {
        userId,
        title: input.title.trim(),
        start,
        end,
        source: EventSource.eventra,
        ...calendarScalarData(input),
        ...nestedGuestReminderCreate(input),
      },
      include: EVENT_DETAIL_INCLUDE,
    });
    const exported = await this.attachGoogleCopy(userId, created);
    return toEventDto(exported);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateEventInput,
  ): Promise<Event> {
    const { masterId, instanceStart } = parseMasterEventId(id);
    const existing = await this.prisma.event.findFirst({
      where: { id: masterId, userId },
      include: EVENT_DETAIL_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }

    let start = existing.start;
    let end = existing.end;
    if (input.start || input.end) {
      const nextStart = input.start
        ? parseIsoDate(input.start, 'start')
        : instanceStart ?? existing.start;
      const nextEnd = input.end ? parseIsoDate(input.end, 'end') : existing.end;
      assertRange(nextStart, nextEnd);
      if (instanceStart) {
        const delta = nextStart.getTime() - instanceStart.getTime();
        start = new Date(existing.start.getTime() + delta);
        end = new Date(start.getTime() + (nextEnd.getTime() - nextStart.getTime()));
      } else {
        start = nextStart;
        end = input.end ? nextEnd : new Date(
          start.getTime() + (existing.end.getTime() - existing.start.getTime()),
        );
      }
      assertRange(start, end);
    }

    const scalars = calendarScalarData(input);
    const nextTitle = input.title?.trim() ?? existing.title;
    const nextGuests =
      input.guests !== undefined
        ? mergeGuestsForWrite(existing.guests, input.guests)
        : existing.guests.map((guest) => ({
            email: guest.email,
            name: guest.name,
            response: guest.response,
          }));
    const nextReminders =
      input.reminders !== undefined
        ? reminderCreateData(input.reminders)
        : existing.reminders.map((reminder) => ({
            minutesBefore: reminder.minutesBefore,
          }));

    if (existing.source === EventSource.google && !existing.googleEventId) {
      throw new BadRequestException(
        'This Google Calendar event is missing a Google id.',
      );
    }
    if (existing.googleEventId) {
      await this.googleWrite.patchEvent(userId, existing.googleEventId, {
        title: nextTitle,
        start,
        end,
        location:
          scalars.location !== undefined ? scalars.location : existing.location,
        description:
          scalars.description !== undefined
            ? scalars.description
            : existing.description,
        allDay: scalars.allDay ?? existing.allDay,
        timezone:
          scalars.timezone !== undefined ? scalars.timezone : existing.timezone,
        recurrence:
          scalars.recurrence !== undefined
            ? scalars.recurrence
            : existing.recurrence,
        busy: scalars.busy ?? existing.busy,
        visibility: scalars.visibility ?? existing.visibility,
        color: scalars.color !== undefined ? scalars.color : existing.color,
        guestCanModify: scalars.guestCanModify ?? existing.guestCanModify,
        guestCanInvite: scalars.guestCanInvite ?? existing.guestCanInvite,
        guestCanSeeOthers:
          scalars.guestCanSeeOthers ?? existing.guestCanSeeOthers,
        guests: nextGuests,
        reminders: nextReminders,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.event.update({
        where: { id: existing.id },
        data: {
          title: nextTitle,
          start,
          end,
          ...scalars,
        },
        include: EVENT_DETAIL_INCLUDE,
      });

      if (input.guests !== undefined || input.reminders !== undefined) {
        await replaceEventGuestsReminders(tx, row.id, input);
      }

      if (row.taskId) {
        await syncTaskFromEvent(tx, row, input);
      }

      return tx.event.findFirstOrThrow({
        where: { id: row.id },
        include: EVENT_DETAIL_INCLUDE,
      });
    });

    return toEventDto(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const { masterId } = parseMasterEventId(id);
    const existing = await this.prisma.event.findFirst({
      where: { id: masterId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (existing.googleEventId) {
      await this.googleWrite.deleteEvent(userId, existing.googleEventId);
    }
    await this.prisma.event.delete({ where: { id: existing.id } });
    return true;
  }

  async scheduleTaskForUser(
    userId: string,
    input: ScheduleTaskInput,
  ): Promise<Event> {
    const task = await this.prisma.task.findFirst({
      where: { id: input.taskId, userId },
      include: TASK_DETAIL_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status === TaskBoardStatus.done) {
      throw new BadRequestException('Cannot schedule a completed task.');
    }

    const { start, end } = parseRange(input.start, input.end);
    const previousStart = task.start;
    const previousEnd = task.end;
    const created = await this.prisma.event.create({
      data: {
        userId,
        title: task.name,
        start,
        end,
        source: EventSource.eventra,
        taskId: task.id,
        ...calendarDataFromTask(task),
      },
      include: EVENT_DETAIL_INCLUDE,
    });

    await this.prisma.task.update({
      where: { id: task.id },
      data: { start, end },
    });

    try {
      const exported = await this.attachGoogleCopy(userId, created);
      return toEventDto(exported);
    } catch (err) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { start: previousStart, end: previousEnd },
      });
      throw err;
    }
  }

  private async attachGoogleCopy(
    userId: string,
    created: EventWithDetails,
  ): Promise<EventWithDetails> {
    try {
      const googleEventId = await this.googleWrite.createEventraCopyIfEnabled(
        userId,
        toGoogleWriteEvent(created),
      );
      if (!googleEventId) return created;
      return this.prisma.event.update({
        where: { id: created.id },
        data: { googleEventId },
        include: EVENT_DETAIL_INCLUDE,
      });
    } catch (err) {
      await this.prisma.event.delete({ where: { id: created.id } });
      throw err;
    }
  }
}

type PrismaTx = Prisma.TransactionClient;

function mergeGuestsForWrite(
  existing: { email: string; name: string | null; response: GuestResponse }[],
  inputGuests: UpdateEventInput['guests'],
): { email: string; name: string | null; response: GuestResponse }[] {
  const previous = new Map(
    existing.map((guest) => [guest.email, guest] as const),
  );
  return guestCreateData(inputGuests).map((guest) => ({
    email: guest.email,
    name: guest.name,
    response: previous.get(guest.email)?.response ?? GuestResponse.needsAction,
  }));
}

async function replaceEventGuestsReminders(
  tx: PrismaTx,
  eventId: string,
  input: UpdateEventInput,
): Promise<void> {
  if (input.guests !== undefined) {
    await tx.eventGuest.deleteMany({ where: { eventId } });
    const rows = guestCreateData(input.guests);
    if (rows.length > 0) {
      await tx.eventGuest.createMany({
        data: rows.map((row) => ({ ...row, eventId })),
      });
    }
  }
  if (input.reminders !== undefined) {
    await tx.eventReminder.deleteMany({ where: { eventId } });
    const rows = reminderCreateData(input.reminders);
    if (rows.length > 0) {
      await tx.eventReminder.createMany({
        data: rows.map((row) => ({ ...row, eventId })),
      });
    }
  }
}

async function syncTaskFromEvent(
  tx: PrismaTx,
  event: EventWithDetails,
  input: UpdateEventInput,
): Promise<void> {
  if (!event.taskId) return;
  await tx.task.update({
    where: { id: event.taskId },
    data: {
      name: event.title,
      location: event.location,
      description: event.description,
      allDay: event.allDay,
      timezone: event.timezone,
      recurrence: event.recurrence,
      busy: event.busy,
      visibility: event.visibility,
      conferenceUrl: event.conferenceUrl,
      color: event.color,
      guestCanModify: event.guestCanModify,
      guestCanInvite: event.guestCanInvite,
      guestCanSeeOthers: event.guestCanSeeOthers,
      start: event.start,
      end: event.end,
    },
  });

  if (input.guests !== undefined) {
    await tx.taskGuest.deleteMany({ where: { taskId: event.taskId } });
    const rows = guestCreateData(input.guests);
    if (rows.length > 0) {
      await tx.taskGuest.createMany({
        data: rows.map((row) => ({ ...row, taskId: event.taskId! })),
      });
    }
  }
  if (input.reminders !== undefined) {
    await tx.taskReminder.deleteMany({ where: { taskId: event.taskId } });
    const rows = reminderCreateData(input.reminders);
    if (rows.length > 0) {
      await tx.taskReminder.createMany({
        data: rows.map((row) => ({ ...row, taskId: event.taskId! })),
      });
    }
  }
}
