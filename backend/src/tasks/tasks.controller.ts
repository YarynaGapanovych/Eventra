import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  async list(@Headers('authorization') authorization?: string) {
    const userId = this.requireUserId(authorization);
    return this.tasksService.listForUser(userId);
  }

  private requireUserId(authorization?: string): string {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return payload.sub;
  }
}
