import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TaskBoardStatus, TaskPriority } from '../generated/prisma/client';
import { Event } from '../events/event.types';

registerEnumType(TaskBoardStatus, { name: 'TaskBoardStatus' });
registerEnumType(TaskPriority, { name: 'TaskPriority' });

@ObjectType()
export class TaskEmployee {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;
}

@ObjectType()
export class Task {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  progressStatus!: string;

  @Field(() => TaskBoardStatus)
  status!: TaskBoardStatus;

  @Field(() => TaskPriority)
  priority!: TaskPriority;

  @Field(() => String, { nullable: true })
  deadline!: string | null;

  @Field(() => String, { nullable: true })
  areaId!: string | null;

  @Field(() => [TaskEmployee])
  employees!: TaskEmployee[];

  @Field(() => [Event])
  events!: Event[];
}

@InputType()
export class CreateTaskInput {
  @Field()
  @IsString()
  @MinLength(1)
  name!: string;

  @Field(() => TaskBoardStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TaskBoardStatus)
  status?: TaskBoardStatus;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

@InputType()
export class UpdateTaskInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @Field(() => TaskBoardStatus, { nullable: true })
  @IsOptional()
  @IsEnum(TaskBoardStatus)
  status?: TaskBoardStatus;

  @Field(() => TaskPriority, { nullable: true })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  deadline?: string | null;
}
