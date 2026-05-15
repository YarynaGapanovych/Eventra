import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, ProgressStatus } from '@prisma/client';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_TOPIC = 'eventra.tasks.v1';

type TaskCreateMessage = {
  type: 'task.create';
  taskId: string;
  name: string;
  startDate: string;
  endDate: string;
  progressStatus?: string;
  areaId?: string | null;
  scheduled?: boolean;
  employeeIds?: string[];
};

@Injectable()
export class TaskConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskConsumerService.name);
  private consumer: Consumer;

  constructor(private readonly prisma: PrismaService) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim());
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? 'eventra-worker',
      brokers,
    });
    this.consumer = kafka.consumer({
      groupId: process.env.KAFKA_GROUP_ID ?? 'eventra-worker',
    });
  }

  async onModuleInit() {
    const topic = process.env.KAFKA_TASKS_TOPIC ?? DEFAULT_TOPIC;
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: (payload) => this.handleMessage(payload),
    });
    this.logger.log(`Subscribed to ${topic}`);
  }

  async onModuleDestroy() {
    await this.consumer.disconnect();
  }

  private async handleMessage({ message }: EachMessagePayload) {
    const raw = message.value?.toString();
    if (!raw) return;

    let parsed: TaskCreateMessage;
    try {
      parsed = JSON.parse(raw) as TaskCreateMessage;
    } catch {
      this.logger.warn('Invalid JSON, skipping message');
      return;
    }

    if (parsed.type !== 'task.create' || !parsed.taskId) {
      return;
    }

    try {
      await this.persistTask(parsed);
    } catch (e) {
      this.logger.error(
        `Failed to persist task ${parsed.taskId}`,
        e instanceof Error ? e.stack : e,
      );
    }
  }

  private async persistTask(msg: TaskCreateMessage) {
    const existing = await this.prisma.task.findUnique({
      where: { id: msg.taskId },
    });
    if (existing) {
      return;
    }

    const progressStatus = this.parseProgress(msg.progressStatus);

    const data: Prisma.TaskCreateInput = {
      id: msg.taskId,
      name: msg.name,
      startDate: new Date(msg.startDate),
      endDate: new Date(msg.endDate),
      progressStatus,
      scheduled: msg.scheduled ?? true,
      area: msg.areaId
        ? { connect: { id: msg.areaId } }
        : undefined,
      employees: msg.employeeIds?.length
        ? { connect: msg.employeeIds.map((id) => ({ id })) }
        : undefined,
    };

    await this.prisma.task.create({ data });
    this.logger.log(`Created task ${msg.taskId}`);
  }

  private parseProgress(value?: string): ProgressStatus {
    if (
      value &&
      Object.values(ProgressStatus).includes(value as ProgressStatus)
    ) {
      return value as ProgressStatus;
    }
    return ProgressStatus.NOT_STARTED;
  }
}
