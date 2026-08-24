import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type Part,
} from '@google/genai';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { UserSettingsService } from '../user-settings/user-settings.service';
import type { UserSettings } from '../user-settings/user-settings.types';
import {
  executeAssistantTool,
  MUTATING_TOOLS,
  TOOL_DECLARATIONS,
} from './ai.tools';
import type {
  AssistantMessage,
  AssistantReply,
  AssistantThread,
} from './ai.types';

const MAX_GEMINI_MESSAGES = 20;
const MAX_STORED_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 8000;
const THREAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_MODEL = 'gemini-3.6-flash';
const MAX_TOOL_ROUNDS = 6;

type ThreadRow = {
  id: string;
  userId: string;
  updatedAt: Date;
  messages: MessageRow[];
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly events: EventsService,
    private readonly userSettings: UserSettingsService,
  ) {}

  async getThread(userId: string): Promise<AssistantThread> {
    const thread = await this.expireIfStale(await this.getOrCreateThread(userId));
    return this.toThreadDto(thread);
  }

  async resetThread(userId: string): Promise<boolean> {
    const thread = await this.getOrCreateThread(userId);
    await this.prisma.assistantMessage.deleteMany({
      where: { threadId: thread.id },
    });
    await this.prisma.assistantThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
    return true;
  }

  async ask(userId: string, content: string): Promise<AssistantReply> {
    const text = content.trim();
    if (!text) {
      throw new BadRequestException('Send at least one message.');
    }
    if (text.length > MAX_CONTENT_LENGTH) {
      throw new BadRequestException('Message is too long.');
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI is not configured. Add GEMINI_API_KEY to the backend environment.',
      );
    }

    const thread = await this.expireIfStale(await this.getOrCreateThread(userId));
    const userMessage = await this.prisma.assistantMessage.create({
      data: { threadId: thread.id, role: 'user', content: text },
    });
    await this.touchThread(thread.id);

    const history = [...thread.messages, userMessage]
      .filter(
        (message) =>
          (message.role === 'user' || message.role === 'assistant') &&
          message.content.trim(),
      )
      .slice(-MAX_GEMINI_MESSAGES);

    const settings = await this.userSettings.getOrCreateForUser(userId);
    const reply = await this.generateReply(userId, apiKey, settings, history);

    await this.prisma.assistantMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        content: reply.content,
      },
    });
    await this.touchThread(thread.id);
    await this.trimOldest(thread.id);

    return reply;
  }

  private async generateReply(
    userId: string,
    apiKey: string,
    settings: UserSettings,
    history: MessageRow[],
  ): Promise<AssistantReply> {
    const model =
      this.config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
    const client = new GoogleGenAI({ apiKey });
    const contents: Content[] = history.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

    let didMutate = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(settings),
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          },
        });
      } catch (err) {
        this.logger.error(
          `Gemini request failed: ${err instanceof Error ? err.message : err}`,
        );
        throw new ServiceUnavailableException(geminiErrorMessage(err));
      }

      if (response.promptFeedback?.blockReason) {
        throw new ServiceUnavailableException(
          'The assistant could not answer that request.',
        );
      }

      const functionCalls = response.functionCalls ?? [];
      if (functionCalls.length === 0) {
        const text = response.text?.trim();
        if (!text) {
          throw new ServiceUnavailableException(
            'The assistant returned an empty reply.',
          );
        }
        return { content: text, didMutate };
      }

      const modelContent = response.candidates?.[0]?.content;
      contents.push(
        modelContent ?? {
          role: 'model',
          parts: functionCalls.map((call) => ({ functionCall: call })),
        },
      );

      const responseParts: Part[] = [];
      for (const call of functionCalls) {
        const outcome = await this.runCall(userId, call);
        if (outcome.mutated) didMutate = true;
        responseParts.push(outcome.part);
      }
      contents.push({ role: 'user', parts: responseParts });
    }

    throw new ServiceUnavailableException(
      'The assistant took too many steps. Try a simpler request.',
    );
  }

  private async runCall(
    userId: string,
    call: FunctionCall,
  ): Promise<{ part: Part; mutated: boolean }> {
    const name = call.name?.trim() ?? '';
    const args =
      call.args && typeof call.args === 'object' ? call.args : {};
    const { ok, payload } = await executeAssistantTool(name, args, {
      userId,
      tasks: this.tasks,
      events: this.events,
    });
    return {
      mutated: ok && MUTATING_TOOLS.has(name),
      part: {
        functionResponse: {
          name,
          id: call.id,
          response: payload,
        },
      },
    };
  }

  private async getOrCreateThread(userId: string): Promise<ThreadRow> {
    return this.prisma.assistantThread.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async expireIfStale(thread: ThreadRow): Promise<ThreadRow> {
    if (thread.messages.length === 0) return thread;
    if (Date.now() - thread.updatedAt.getTime() <= THREAD_TTL_MS) {
      return thread;
    }
    await this.prisma.assistantMessage.deleteMany({
      where: { threadId: thread.id },
    });
    await this.touchThread(thread.id);
    return { ...thread, messages: [], updatedAt: new Date() };
  }

  private async touchThread(threadId: string): Promise<void> {
    await this.prisma.assistantThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
  }

  private async trimOldest(threadId: string): Promise<void> {
    const count = await this.prisma.assistantMessage.count({
      where: { threadId },
    });
    if (count <= MAX_STORED_MESSAGES) return;
    const extra = count - MAX_STORED_MESSAGES;
    const oldest = await this.prisma.assistantMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: extra,
      select: { id: true },
    });
    await this.prisma.assistantMessage.deleteMany({
      where: { id: { in: oldest.map((row) => row.id) } },
    });
  }

  private toThreadDto(thread: ThreadRow): AssistantThread {
    const expiresAt =
      thread.messages.length > 0
        ? new Date(thread.updatedAt.getTime() + THREAD_TTL_MS).toISOString()
        : null;
    return {
      expiresAt,
      messages: thread.messages.map(toMessageDto),
    };
  }
}

function toMessageDto(message: MessageRow): AssistantMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

function buildSystemPrompt(settings: UserSettings): string {
  const now = new Date().toISOString();
  return [
    "You are Eventra's assistant. Help the signed-in user with their tasks and calendar.",
    `Current datetime (UTC): ${now}. User timezone: ${settings.timezone}.`,
    `Workday is ${settings.workdayStart}–${settings.workdayEnd}. Default event duration is ${settings.defaultEventDurationMinutes} minutes.`,
    'Use tools to read and change data. Never invent task or event ids — look them up first.',
    'When creating times, use ISO 8601 datetimes. Interpret relative times like "tomorrow at 3pm" in the user timezone.',
    'Do not delete items. Do not edit Google Calendar events (source=google); only Eventra events can be updated.',
    'After a change, confirm what you did with names and times. Be concise.',
    'Format replies with simple Markdown only: **bold** and * or - bullet lists. No headings or code fences.',
  ].join('\n');
}

function geminiErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) {
    if (/not found|404/i.test(err.message)) {
      return 'Gemini model is unavailable. Set GEMINI_MODEL in the backend environment (try gemini-3.6-flash).';
    }
    if (/api key|permission|401|403/i.test(err.message)) {
      return 'Gemini rejected the API key. Check GEMINI_API_KEY.';
    }
  }
  return 'The assistant is unavailable right now. Try again in a moment.';
}
