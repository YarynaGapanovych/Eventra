import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const TIME_HM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

@ObjectType()
export class UserSettings {
  @Field()
  workdayStart!: string;

  @Field()
  workdayEnd!: string;

  @Field()
  timezone!: string;

  @Field(() => Int)
  defaultEventDurationMinutes!: number;

  @Field()
  showPastDoneTaskEvents!: boolean;
}

@InputType()
export class UpdateUserSettingsInput {
  @Field()
  @IsString()
  @Matches(TIME_HM, { message: 'Use 24-hour time (HH:mm).' })
  workdayStart!: string;

  @Field()
  @IsString()
  @Matches(TIME_HM, { message: 'Use 24-hour time (HH:mm).' })
  workdayEnd!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  timezone!: string;

  @Field(() => Int)
  @IsInt()
  @Min(5)
  @Max(24 * 60)
  defaultEventDurationMinutes!: number;

  @Field()
  @IsBoolean()
  showPastDoneTaskEvents!: boolean;
}
