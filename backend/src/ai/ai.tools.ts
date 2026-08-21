import { HttpException } from '@nestjs/common';
import {
  Type,
  type FunctionDeclaration,
} from '@google/genai';
import {
  TaskBoardStatus,
  TaskPriority,
} from '../generated/prisma/client';
import type { EventsService } from '../events/events.service';
import type { TasksService } from '../tasks/tasks.service';
import type { Task } from '../tasks/task.types';
import type { Event } from '../events/event.types';

export const MUTATING_TOOLS = new Set([
  'create_task',
  'update_task',
  'create_event',
  'update_event',
  'schedule_task',
]);

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_tasks',
    description:
      "List the signed-in user's tasks. Returns id, name, status, priority, deadline, and schedule.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Optional filter: todo, in_progress, or done.',
          enum: ['todo', 'in_progress', 'done'],
        },
      },
    },
  },
  {
    name: 'list_events',
    description:
      "List the signed-in user's upcoming calendar events (Eventra and Google-synced). Returns id, title, start, end, source.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.NUMBER,
          description: 'How many days ahead to include. Defaults to 14. Max 30.',
        },
      },
    },
  },
  {
    name: 'create_task',
    description: 'Create a task for the signed-in user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Task name.',
        },
        status: {
          type: Type.STRING,
          enum: ['todo', 'in_progress', 'done'],
        },
        priority: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high'],
        },
        deadline: {
          type: Type.STRING,
          description: 'ISO 8601 deadline.',
        },
        start: {
          type: Type.STRING,
          description: 'ISO 8601 start if scheduling the task on the calendar.',
        },
        end: {
          type: Type.STRING,
          description: 'ISO 8601 end if scheduling the task on the calendar.',
        },
        description: { type: Type.STRING },
        location: { type: Type.STRING },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task by id. Only Eventra tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Task id from list_tasks.' },
        name: { type: Type.STRING },
        status: {
          type: Type.STRING,
          enum: ['todo', 'in_progress', 'done'],
        },
        priority: {
          type: Type.STRING,
          enum: ['low', 'medium', 'high'],
        },
        deadline: {
          type: Type.STRING,
          description: 'ISO 8601 deadline.',
        },
        start: { type: Type.STRING },
        end: { type: Type.STRING },
        description: { type: Type.STRING },
        location: { type: Type.STRING },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_event',
    description: 'Create an Eventra calendar event (not a Google Calendar event).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        start: { type: Type.STRING, description: 'ISO 8601 start.' },
        end: { type: Type.STRING, description: 'ISO 8601 end.' },
        description: { type: Type.STRING },
        location: { type: Type.STRING },
        allDay: { type: Type.BOOLEAN },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'update_event',
    description:
      'Update an Eventra calendar event by id. Google Calendar events cannot be edited.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Event id from list_events.' },
        title: { type: Type.STRING },
        start: { type: Type.STRING },
        end: { type: Type.STRING },
        description: { type: Type.STRING },
        location: { type: Type.STRING },
      },
      required: ['id'],
    },
  },
  {
    name: 'schedule_task',
    description: 'Put an existing task on the calendar with a start and end time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING },
        start: { type: Type.STRING, description: 'ISO 8601 start.' },
        end: { type: Type.STRING, description: 'ISO 8601 end.' },
      },
      required: ['taskId', 'start', 'end'],
    },
  },
];

export type ToolContext = {
  userId: string;
  tasks: TasksService;
  events: EventsService;
};

const LIST_LIMIT = 60;

export async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ ok: boolean; payload: Record<string, unknown> }> {
  try {
    const data = await runTool(name, args, ctx);
    return { ok: true, payload: { result: data } };
  } catch (err) {
    return { ok: false, payload: { error: toolErrorMessage(err) } };
  }
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  switch (name) {
    case 'list_tasks': {
      const status = asBoardStatus(args.status);
      const tasks = await ctx.tasks.listForUser(ctx.userId);
      const filtered = status
        ? tasks.filter((task) => task.status === status)
        : tasks;
      return { items: filtered.slice(0, LIST_LIMIT).map(compactTask) };
    }
    case 'list_events': {
      const days = clampDays(args.days);
      const events = await ctx.events.listForUser(ctx.userId);
      return { items: compactUpcomingEvents(events, days) };
    }
    case 'create_task': {
      const created = await ctx.tasks.createForUser(ctx.userId, {
        name: requiredString(args.name, 'name'),
        status: asBoardStatus(args.status),
        priority: asPriority(args.priority),
        deadline: optionalString(args.deadline),
        start: optionalString(args.start),
        end: optionalString(args.end),
        description: optionalString(args.description),
        location: optionalString(args.location),
      });
      return compactTask(created);
    }
    case 'update_task': {
      const updated = await ctx.tasks.updateForUser(
        ctx.userId,
        requiredString(args.id, 'id'),
        {
          name: optionalString(args.name),
          status: asBoardStatus(args.status),
          priority: asPriority(args.priority),
          deadline: optionalString(args.deadline),
          start: optionalString(args.start),
          end: optionalString(args.end),
          description: optionalString(args.description),
          location: optionalString(args.location),
        },
      );
      return compactTask(updated);
    }
    case 'create_event': {
      const created = await ctx.events.createForUser(ctx.userId, {
        title: requiredString(args.title, 'title'),
        start: requiredString(args.start, 'start'),
        end: requiredString(args.end, 'end'),
        description: optionalString(args.description),
        location: optionalString(args.location),
        allDay: asOptionalBoolean(args.allDay),
      });
      return compactEvent(created);
    }
    case 'update_event': {
      const updated = await ctx.events.updateForUser(
        ctx.userId,
        requiredString(args.id, 'id'),
        {
          title: optionalString(args.title),
          start: optionalString(args.start),
          end: optionalString(args.end),
          description: optionalString(args.description),
          location: optionalString(args.location),
        },
      );
      return compactEvent(updated);
    }
    case 'schedule_task': {
      const scheduled = await ctx.events.scheduleTaskForUser(ctx.userId, {
        taskId: requiredString(args.taskId, 'taskId'),
        start: requiredString(args.start, 'start'),
        end: requiredString(args.end, 'end'),
      });
      return compactEvent(scheduled);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function compactTask(task: Task) {
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    start: task.start,
    end: task.end,
    location: task.location,
  };
}

function compactEvent(event: Event) {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    source: event.source,
    location: event.location,
    taskId: event.taskId,
  };
}

function compactUpcomingEvents(events: Event[], days: number) {
  const from = Date.now() - 12 * 60 * 60 * 1000;
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  return events
    .filter((event) => {
      const start = Date.parse(event.start);
      return !Number.isNaN(start) && start >= from && start <= until;
    })
    .slice(0, LIST_LIMIT)
    .map(compactEvent);
}

function clampDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 14;
  return Math.min(30, Math.max(1, Math.round(value)));
}

function requiredString(value: unknown, field: string): string {
  const text = optionalString(value);
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 ? text : undefined;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asBoardStatus(value: unknown): TaskBoardStatus | undefined {
  if (value === 'todo' || value === 'in_progress' || value === 'done') {
    return value;
  }
  return undefined;
}

function asPriority(value: unknown): TaskPriority | undefined {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return undefined;
}

function toolErrorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const response = err.getResponse();
    if (typeof response === 'string') return response;
    if (
      typeof response === 'object' &&
      response &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Tool failed';
}
