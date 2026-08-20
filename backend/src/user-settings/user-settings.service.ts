import { BadRequestException, Injectable } from '@nestjs/common';
import type { UserSettings as PrismaUserSettings } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TIME_HM,
  type UpdateUserSettingsInput,
  type UserSettings,
} from './user-settings.types';

@Injectable()
export class UserSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForUser(userId: string): Promise<UserSettings> {
    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    return this.toDto(row);
  }

  async updateForUser(
    userId: string,
    input: UpdateUserSettingsInput,
  ): Promise<UserSettings> {
    const workdayStart = input.workdayStart.trim();
    const workdayEnd = input.workdayEnd.trim();
    const timezone = normalizeTimezone(input.timezone);
    assertWorkdayRange(workdayStart, workdayEnd);

    const row = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        workdayStart,
        workdayEnd,
        timezone,
        defaultEventDurationMinutes: input.defaultEventDurationMinutes,
        showPastDoneTaskEvents: input.showPastDoneTaskEvents,
      },
      create: {
        userId,
        workdayStart,
        workdayEnd,
        timezone,
        defaultEventDurationMinutes: input.defaultEventDurationMinutes,
        showPastDoneTaskEvents: input.showPastDoneTaskEvents,
      },
    });
    return this.toDto(row);
  }

  private toDto(row: PrismaUserSettings): UserSettings {
    return {
      workdayStart: row.workdayStart,
      workdayEnd: row.workdayEnd,
      timezone: row.timezone,
      defaultEventDurationMinutes: row.defaultEventDurationMinutes,
      showPastDoneTaskEvents: row.showPastDoneTaskEvents,
    };
  }
}

function minutesFromHm(value: string): number | null {
  if (!TIME_HM.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function assertWorkdayRange(workdayStart: string, workdayEnd: string): void {
  const startM = minutesFromHm(workdayStart);
  const endM = minutesFromHm(workdayEnd);
  if (startM == null || endM == null) {
    throw new BadRequestException('Use 24-hour time (HH:mm).');
  }
  if (endM <= startM) {
    throw new BadRequestException('End time must be after start time.');
  }
}

function normalizeTimezone(value: string): string {
  const timezone = value.trim();
  if (!timezone) {
    throw new BadRequestException('Time zone is required.');
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new BadRequestException('Time zone is invalid.');
  }
  return timezone;
}
