import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export type CalendarOverlapNotice = {
  id: string;
  title: string;
  overlappingTitles: string[];
  start: string;
  end: string;
};

export function parseOverlapNotices(value: unknown): CalendarOverlapNotice[] {
  if (!Array.isArray(value)) return [];
  const notices: CalendarOverlapNotice[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string') continue;
    if (typeof row.start !== 'string' || typeof row.end !== 'string') continue;
    const overlappingTitles = Array.isArray(row.overlappingTitles)
      ? row.overlappingTitles.filter(
          (title): title is string => typeof title === 'string',
        )
      : [];
    notices.push({
      id: row.id,
      title: row.title,
      overlappingTitles,
      start: row.start,
      end: row.end,
    });
  }
  return notices;
}

@ObjectType()
export class GoogleCalendarOverlapNotice {
  @Field()
  id!: string;

  @Field()
  title!: string;

  @Field(() => [String])
  overlappingTitles!: string[];

  @Field()
  start!: string;

  @Field()
  end!: string;
}

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

  @Field(() => [GoogleCalendarOverlapNotice])
  pendingOverlaps!: GoogleCalendarOverlapNotice[];
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

  @Field(() => [GoogleCalendarOverlapNotice])
  overlaps!: GoogleCalendarOverlapNotice[];
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
