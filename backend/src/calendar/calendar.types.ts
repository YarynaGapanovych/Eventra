import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  EventVisibility,
  GuestResponse,
} from '../generated/prisma/client';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

registerEnumType(EventVisibility, { name: 'EventVisibility' });
registerEnumType(GuestResponse, { name: 'GuestResponse' });

export { EventVisibility, GuestResponse };

@ObjectType()
export class CalendarGuest {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;

  @Field(() => GuestResponse)
  response!: GuestResponse;
}

@ObjectType()
export class CalendarReminder {
  @Field()
  id!: string;

  @Field(() => Int)
  minutesBefore!: number;
}

@InputType()
export class CalendarGuestInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

@InputType()
export class CalendarReminderInput {
  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(60 * 24 * 30)
  minutesBefore!: number;
}

@ObjectType({ isAbstract: true })
export class CalendarDetailsFields {
  @Field(() => String, { nullable: true })
  location!: string | null;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field()
  allDay!: boolean;

  @Field(() => String, { nullable: true })
  timezone!: string | null;

  @Field(() => String, { nullable: true })
  recurrence!: string | null;

  @Field()
  busy!: boolean;

  @Field(() => EventVisibility)
  visibility!: EventVisibility;

  @Field(() => String, { nullable: true })
  conferenceUrl!: string | null;

  @Field()
  guestCanModify!: boolean;

  @Field()
  guestCanInvite!: boolean;

  @Field()
  guestCanSeeOthers!: boolean;

  @Field(() => [CalendarGuest])
  guests!: CalendarGuest[];

  @Field(() => [CalendarReminder])
  reminders!: CalendarReminder[];
}

@InputType({ isAbstract: true })
export class CalendarDetailsInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  recurrence?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  busy?: boolean;

  @Field(() => EventVisibility, { nullable: true })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conferenceUrl?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(HEX_COLOR, { message: 'Color must be a 6-digit hex value.' })
  color?: string | null;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  guestCanModify?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  guestCanInvite?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  guestCanSeeOthers?: boolean;

  @Field(() => [CalendarGuestInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarGuestInput)
  guests?: CalendarGuestInput[];

  @Field(() => [CalendarReminderInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalendarReminderInput)
  reminders?: CalendarReminderInput[];
}

export { HEX_COLOR };
