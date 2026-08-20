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
import {
  CalendarDetailsFields,
  CalendarDetailsInput,
} from '../calendar/calendar.types';
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
export class Task extends CalendarDetailsFields {
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

  @Field(() => String, { nullable: true })
  start!: string | null;

  @Field(() => String, { nullable: true })
  end!: string | null;

  @Field(() => String, { nullable: true })
  color!: string | null;

  @Field(() => [TaskEmployee])
  employees!: TaskEmployee[];

  @Field(() => [Event])
  events!: Event[];
}

@InputType()
export class CreateTaskInput extends CalendarDetailsInput {
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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  start?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDateString()
  end?: string;
}

@InputType()
export class UpdateTaskInput extends CalendarDetailsInput {
  @Field(() => String, { nullable: true })
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

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  start?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsDateString()
  end?: string | null;
}
