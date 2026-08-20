import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';
import { EventSource } from '../generated/prisma/client';

registerEnumType(EventSource, { name: 'EventSource' });

@ObjectType()
export class Event {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field()
  start!: string;

  @Field()
  end!: string;

  @Field(() => EventSource)
  source!: EventSource;

  @Field(() => String, { nullable: true })
  googleEventId!: string | null;

  @Field(() => String, { nullable: true })
  taskId!: string | null;
}

@InputType()
export class CreateEventInput {
  @Field()
  @IsString()
  @MinLength(1)
  title!: string;

  @Field()
  @IsDateString()
  start!: string;

  @Field()
  @IsDateString()
  end!: string;
}

@InputType()
export class UpdateEventInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  start?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  end?: string;
}

@InputType()
export class ScheduleTaskInput {
  @Field()
  @IsString()
  @MinLength(1)
  taskId!: string;

  @Field()
  @IsDateString()
  start!: string;

  @Field()
  @IsDateString()
  end!: string;
}
