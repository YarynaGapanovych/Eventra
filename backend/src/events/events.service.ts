import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Event as PrismaEvent } from '../generated/prisma/client';
import { EventSource, TaskBoardStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEventInput,
  Event,
  ScheduleTaskInput,
  UpdateEventInput,
} from './event.types';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<Event[]> {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });
    const showPastDone = settings?.showPastDoneTaskEvents ?? true;
    const now = new Date();

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
      orderBy: { start: 'asc' },
    });
    return rows.map((event) => this.toDto(event));
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
        color: normalizeHexColor(input.color),
      },
    });
    return this.toDto(created);
  }

  async updateForUser(
    userId: string,
    id: string,
    input: UpdateEventInput,
  ): Promise<Event> {
    const existing = await this.prisma.event.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (existing.source === EventSource.google) {
      throw new BadRequestException(
        'Google Calendar events cannot be edited in Eventra.',
      );
    }

    const start = input.start
      ? parseIsoDate(input.start, 'start')
      : existing.start;
    const end = input.end ? parseIsoDate(input.end, 'end') : existing.end;
    assertRange(start, end);

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        title: input.title?.trim() ?? existing.title,
        start,
        end,
        color:
          input.color !== undefined
            ? normalizeHexColor(input.color)
            : existing.color,
      },
    });
    return this.toDto(updated);
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const existing = await this.prisma.event.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Event not found');
    }
    if (existing.source === EventSource.google) {
      throw new BadRequestException(
        'Google Calendar events cannot be deleted in Eventra.',
      );
    }
    await this.prisma.event.delete({ where: { id } });
    return true;
  }

  async scheduleTaskForUser(
    userId: string,
    input: ScheduleTaskInput,
  ): Promise<Event> {
    const task = await this.prisma.task.findFirst({
      where: { id: input.taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status === TaskBoardStatus.done) {
      throw new BadRequestException('Cannot schedule a completed task.');
    }

    const { start, end } = parseRange(input.start, input.end);
    const created = await this.prisma.event.create({
      data: {
        userId,
        title: task.name,
        start,
        end,
        source: EventSource.eventra,
        taskId: task.id,
      },
    });
    return this.toDto(created);
  }

  private toDto(event: PrismaEvent): Event {
    return {
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      source: event.source,
      googleEventId: event.googleEventId,
      color: event.color,
      taskId: event.taskId,
    };
  }
}

function normalizeHexColor(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function parseIsoDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return parsed;
}

function assertRange(start: Date, end: Date): void {
  if (end.getTime() < start.getTime()) {
    throw new BadRequestException('End must be after start.');
  }
}

function parseRange(
  startValue: string,
  endValue: string,
): { start: Date; end: Date } {
  const start = parseIsoDate(startValue, 'start');
  const end = parseIsoDate(endValue, 'end');
  assertRange(start, end);
  return { start, end };
}
