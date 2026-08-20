import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Event as PrismaEvent,
  Task as PrismaTask,
} from '../generated/prisma/client';
import {
  EventSource,
  TaskBoardStatus,
  TaskPriority,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Event } from '../events/event.types';
import type { CreateTaskInput, Task, UpdateTaskInput } from './task.types';

type TaskWithEvents = PrismaTask & { events: PrismaEvent[] };

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<Task[]> {
    const rows = await this.prisma.task.findMany({
      where: { userId },
      include: { events: { orderBy: { start: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((task) => this.toDto(task));
  }

  async createForUser(userId: string, input: CreateTaskInput): Promise<Task> {
    const status = input.status ?? TaskBoardStatus.todo;
    const created = await this.prisma.task.create({
      data: {
        userId,
        name: input.name.trim(),
        status,
        priority: input.priority ?? TaskPriority.medium,
        deadline: input.deadline
          ? parseIsoDate(input.deadline, 'deadline')
          : undefined,
        progressStatus: progressStatusForBoard(status),
      },
      include: { events: { orderBy: { start: 'asc' } } },
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

    const updated = await this.prisma.$transaction(async (tx) => {
      if (nextName !== existing.name) {
        await tx.event.updateMany({
          where: { taskId: id, source: EventSource.eventra },
          data: { title: nextName },
        });
      }

      if (
        nextStatus === TaskBoardStatus.done &&
        existing.status !== TaskBoardStatus.done
      ) {
        await tx.event.deleteMany({
          where: { taskId: id, start: { gte: new Date() } },
        });
      }

      return tx.task.update({
        where: { id },
        data: {
          name: nextName,
          status: nextStatus,
          priority: input.priority ?? existing.priority,
          deadline,
          progressStatus: progressStatusForBoard(nextStatus),
        },
        include: { events: { orderBy: { start: 'asc' } } },
      });
    });

    return this.toDto(updated);
  }

  private toDto(task: TaskWithEvents): Task {
    return {
      id: task.id,
      name: task.name,
      progressStatus: task.progressStatus,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline?.toISOString() ?? null,
      areaId: task.areaId,
      employees: [],
      events: task.events.map((event) => toEventDto(event)),
    };
  }
}

function toEventDto(event: PrismaEvent): Event {
  return {
    id: event.id,
    title: event.title,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    source: event.source,
    googleEventId: event.googleEventId,
    taskId: event.taskId,
  };
}

function parseIsoDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is invalid`);
  }
  return parsed;
}

function progressStatusForBoard(status: TaskBoardStatus): string {
  if (status === TaskBoardStatus.done) return 'completed';
  if (status === TaskBoardStatus.in_progress) return 'in_progress';
  return 'not_started';
}
