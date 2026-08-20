import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { EventSource } from '../generated/prisma/client';
import {
  CalendarDetailsFields,
  CalendarDetailsInput,
} from '../calendar/calendar.types';

registerEnumType(EventSource, { name: 'EventSource' });

@ObjectType()
export class Event extends CalendarDetailsFields {
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
  color!: string | null;

  @Field(() => String, { nullable: true })
  taskId!: string | null;
}

@InputType()
export class CreateEventInput extends CalendarDetailsInput {
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
export class UpdateEventInput extends CalendarDetailsInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

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
