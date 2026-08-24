import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import { CreateTaskInput, Task, UpdateTaskInput } from './task.types';
import { TasksService } from './tasks.service';

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver(() => Task)
@UseGuards(GqlAuthGuard)
@UsePipes(gqlValidationPipe)
export class TasksResolver {
  constructor(private readonly tasksService: TasksService) {}

  @Query(() => [Task])
  tasks(@CurrentUser() user: JwtUser): Promise<Task[]> {
    return this.tasksService.listForUser(user.userId);
  }

  @Mutation(() => Task)
  createTask(
    @CurrentUser() user: JwtUser,
    @Args('input') input: CreateTaskInput,
  ): Promise<Task> {
    return this.tasksService.createForUser(user.userId, input);
  }

  @Mutation(() => Task)
  updateTask(
    @CurrentUser() user: JwtUser,
    @Args('id') id: string,
    @Args('input') input: UpdateTaskInput,
  ): Promise<Task> {
    return this.tasksService.updateForUser(user.userId, id, input);
  }

  @Mutation(() => Boolean)
  deleteTask(
    @CurrentUser() user: JwtUser,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.tasksService.deleteForUser(user.userId, id);
  }
}
