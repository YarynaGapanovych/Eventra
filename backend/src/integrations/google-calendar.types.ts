import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

@ObjectType()
export class GoogleCalendarStatus {
  @Field()
  connected!: boolean;

  @Field(() => String, { nullable: true })
  connectedAt!: string | null;

  @Field(() => String, { nullable: true })
  lastSyncedAt!: string | null;

  @Field(() => Int)
  syncDaysBack!: number;

  @Field(() => Int)
  syncDaysForward!: number;
}

@ObjectType()
export class GoogleCalendarConnectPayload {
  @Field()
  connectUrl!: string;
}

@ObjectType()
export class GoogleCalendarSyncPayload {
  @Field()
  ok!: boolean;

  @Field()
  syncedAt!: string;

  @Field(() => Int)
  imported!: number;
}

@ObjectType()
export class GoogleCalendarDisconnectPayload {
  @Field()
  ok!: boolean;
}

@InputType()
export class UpdateGoogleCalendarSyncWindowInput {
  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  syncDaysBack?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  syncDaysForward?: number;
}

@InputType()
export class StartGoogleCalendarConnectInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  redirectUri?: string;
}
