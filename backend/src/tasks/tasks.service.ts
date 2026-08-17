import { Injectable } from '@nestjs/common';
import type { Task } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ApiTaskDto = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progressStatus: string;
  status: string;
  priority: string;
  deadline: string | null;
  scheduled: boolean;
  areaId: string | null;
  employees: { id: string; name: string | null }[];
};

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<ApiTaskDto[]> {
    const rows = await this.prisma.task.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((task) => this.toDto(task));
  }

  private toDto(task: Task): ApiTaskDto {
    return {
      id: task.id,
      name: task.name,
      startDate: task.startDate.toISOString(),
      endDate: task.endDate.toISOString(),
      progressStatus: task.progressStatus,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline?.toISOString() ?? null,
      scheduled: task.scheduled,
      areaId: task.areaId,
      employees: [],
    };
  }
}
