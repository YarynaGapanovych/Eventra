import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventSource,
  TaskBoardStatus,
  TaskPriority,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task.types';
import {
  calendarScalarData,
  EVENT_DETAIL_INCLUDE,
  guestCreateData,
  nestedGuestReminderCreate,
  parseIsoDate,
  parseRange,
  reminderCreateData,
  TASK_DETAIL_INCLUDE,
  toEventDto,
  toGuestDtos,
  toReminderDtos,
  type TaskWithDetails,
} from '../calendar/calendar-fields';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { userId },
      include: TASK_DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((task) => this.toDto(task));
  }

  async createForUser(userId: string, input: CreateTaskInput): Promise<Task> {
    const status = input.status ?? TaskBoardStatus.todo;
    const range =
      input.start && input.end ? parseRange(input.start, input.end) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          userId,
          name: input.name.trim(),
          status,
          priority: input.priority ?? TaskPriority.medium,
          deadline: input.deadline
            ? parseIsoDate(input.deadline, 'deadline')
            : undefined,
          progressStatus: progressStatusForBoard(status),
          start: range?.start,
          end: range?.end,
          ...calendarScalarData(input),
          ...nestedGuestReminderCreate(input),
        },
        include: TASK_DETAIL_INCLUDE,
      });

      if (range && status !== TaskBoardStatus.done) {
        await tx.event.create({
          data: {
            userId,
            title: task.name,
            start: range.start,
            end: range.end,
            source: EventSource.eventra,
            taskId: task.id,
            ...calendarScalarData(input),
            ...nestedGuestReminderCreate(input),
          },
        });
      }

      return tx.task.findFirstOrThrow({
        where: { id: task.id },
        include: TASK_DETAIL_INCLUDE,
      });
    });

    return this.toDto(created);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateTaskInput,
  ): Promise<Task> {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
      include: TASK_DETAIL_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }

    const nextStatus = input.status ?? existing.status;
    const nextName = input.name?.trim() ?? existing.name;
    let deadline = existing.deadline;
    if (input.deadline !== undefined) {
      deadline = input.deadline
        ? parseIsoDate(input.deadline, 'deadline')
        : null;
    }

    let start = existing.start;
    let end = existing.end;
    if (input.start !== undefined || input.end !== undefined) {
      const nextStart = input.start
        ? parseIsoDate(input.start, 'start')
        : existing.start;
      const nextEnd = input.end ? parseIsoDate(input.end, 'end') : existing.end;
      if (input.start === null) start = null;
      else if (nextStart) start = nextStart;
      if (input.end === null) end = null;
      else if (nextEnd) end = nextEnd;
      if (start && end && end.getTime() < start.getTime()) {
        throw new BadRequestException('End must be after start.');
      }
    }

    const calendar = calendarScalarData(input);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (
        nextStatus === TaskBoardStatus.done &&
        existing.status !== TaskBoardStatus.done
      ) {
        await tx.event.deleteMany({
          where: { taskId: id, start: { gte: new Date() } },
        });
      }

      const task = await tx.task.update({
        where: { id },
        data: {
          name: nextName,
          status: nextStatus,
          priority: input.priority ?? existing.priority,
          deadline,
          start,
          end,
          progressStatus: progressStatusForBoard(nextStatus),
          ...calendar,
        },
        include: TASK_DETAIL_INCLUDE,
      });

      if (input.guests !== undefined) {
        await tx.taskGuest.deleteMany({ where: { taskId: id } });
        const rows = guestCreateData(input.guests);
        if (rows.length > 0) {
          await tx.taskGuest.createMany({
            data: rows.map((row) => ({ ...row, taskId: id })),
          });
        }
      }
      if (input.reminders !== undefined) {
        await tx.taskReminder.deleteMany({ where: { taskId: id } });
        const rows = reminderCreateData(input.reminders);
        if (rows.length > 0) {
          await tx.taskReminder.createMany({
            data: rows.map((row) => ({ ...row, taskId: id })),
          });
        }
      }

      const eventraEvents = task.events.filter(
        (event) => event.source === EventSource.eventra,
      );

      for (const event of eventraEvents) {
        await tx.event.update({
          where: { id: event.id },
          data: {
            title: nextName,
            ...calendar,
            ...(eventraEvents.length === 1 && start && end
              ? { start, end }
              : {}),
          },
        });
        if (input.guests !== undefined) {
          await tx.eventGuest.deleteMany({ where: { eventId: event.id } });
          const rows = guestCreateData(input.guests);
          if (rows.length > 0) {
            await tx.eventGuest.createMany({
              data: rows.map((row) => ({ ...row, eventId: event.id })),
            });
          }
        }
        if (input.reminders !== undefined) {
          await tx.eventReminder.deleteMany({ where: { eventId: event.id } });
          const rows = reminderCreateData(input.reminders);
          if (rows.length > 0) {
            await tx.eventReminder.createMany({
              data: rows.map((row) => ({ ...row, eventId: event.id })),
            });
          }
        }
      }

      if (
        start &&
        end &&
        eventraEvents.length === 0 &&
        nextStatus !== TaskBoardStatus.done
      ) {
        await tx.event.create({
          data: {
            userId,
            title: nextName,
            start,
            end,
            source: EventSource.eventra,
            taskId: id,
            ...calendarScalarData({
              ...input,
              location: input.location ?? existing.location,
              description: input.description ?? existing.description,
              allDay: input.allDay ?? existing.allDay,
              timezone: input.timezone ?? existing.timezone,
              recurrence: input.recurrence ?? existing.recurrence,
              busy: input.busy ?? existing.busy,
              visibility: input.visibility ?? existing.visibility,
              conferenceUrl: input.conferenceUrl ?? existing.conferenceUrl,
              color: input.color ?? existing.color ?? undefined,
              guestCanModify: input.guestCanModify ?? existing.guestCanModify,
              guestCanInvite: input.guestCanInvite ?? existing.guestCanInvite,
              guestCanSeeOthers:
                input.guestCanSeeOthers ?? existing.guestCanSeeOthers,
            }),
            guests: {
              create: (
                input.guests
                  ? guestCreateData(input.guests)
                  : existing.guests.map((guest) => ({
                      email: guest.email,
                      name: guest.name,
                    }))
              ),
            },
            reminders: {
              create: (
                input.reminders
                  ? reminderCreateData(input.reminders)
                  : existing.reminders.map((reminder) => ({
                      minutesBefore: reminder.minutesBefore,
                    }))
              ),
            },
          },
        });
      }

      return tx.task.findFirstOrThrow({
        where: { id },
        include: TASK_DETAIL_INCLUDE,
      });
    });

    return this.toDto(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.task.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Task not found');
    }
    await this.prisma.task.delete({ where: { id: existing.id } });
    return true;
  }

  private toDto(task: TaskWithDetails): Task {
    return {
      id: task.id,
      name: task.name,
      progressStatus: task.progressStatus,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline?.toISOString() ?? null,
      areaId: task.areaId,
      start: task.start?.toISOString() ?? null,
      end: task.end?.toISOString() ?? null,
      color: task.color,
      location: task.location,
      description: task.description,
      allDay: task.allDay,
      timezone: task.timezone,
      recurrence: task.recurrence,
      busy: task.busy,
      visibility: task.visibility,
      conferenceUrl: task.conferenceUrl,
      guestCanModify: task.guestCanModify,
      guestCanInvite: task.guestCanInvite,
      guestCanSeeOthers: task.guestCanSeeOthers,
      guests: toGuestDtos(task.guests),
      reminders: toReminderDtos(task.reminders),
      employees: [],
      events: task.events.map((event) => toEventDto(event)),
    };
  }
}

function progressStatusForBoard(status: TaskBoardStatus): string {
  if (status === TaskBoardStatus.done) return 'completed';
  if (status === TaskBoardStatus.in_progress) return 'in_progress';
  return 'not_started';
}
