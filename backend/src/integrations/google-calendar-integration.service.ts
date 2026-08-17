import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskSource } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SYNC_DAYS_BACK,
  DEFAULT_SYNC_DAYS_FORWARD,
} from './google-calendar-sync-window';
import {
  GoogleOAuthService,
  type GoogleOAuthTokens,
} from './google-oauth.service';

export type GoogleCalendarConnectionStatus = {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncDaysBack: number;
  syncDaysForward: number;
};

@Injectable()
export class GoogleCalendarIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  async getStatus(userId: string): Promise<GoogleCalendarConnectionStatus> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) {
      return {
        connected: false,
        connectedAt: null,
        lastSyncedAt: null,
        syncDaysBack: DEFAULT_SYNC_DAYS_BACK,
        syncDaysForward: DEFAULT_SYNC_DAYS_FORWARD,
      };
    }
    return {
      connected: true,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      syncDaysBack: row.syncDaysBack,
      syncDaysForward: row.syncDaysForward,
    };
  }

  async getSyncWindow(
    userId: string,
  ): Promise<{ syncDaysBack: number; syncDaysForward: number }> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new BadRequestException('Google Calendar is not connected');
    }
    return {
      syncDaysBack: row.syncDaysBack,
      syncDaysForward: row.syncDaysForward,
    };
  }

  async updateSyncWindow(
    userId: string,
    syncDaysBack: number,
    syncDaysForward: number,
  ): Promise<GoogleCalendarConnectionStatus> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new BadRequestException('Google Calendar is not connected');
    }

    await this.prisma.googleCalendarIntegration.update({
      where: { userId },
      data: { syncDaysBack, syncDaysForward },
    });

    return this.getStatus(userId);
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) {
      throw new BadRequestException('Google Calendar is not connected');
    }

    const bufferMs = 60_000;
    if (
      row.accessTokenEncrypted &&
      row.accessTokenExpiresAt &&
      row.accessTokenExpiresAt.getTime() > Date.now() + bufferMs
    ) {
      return this.googleOAuth.decryptToken(row.accessTokenEncrypted);
    }

    const refreshToken = this.googleOAuth.decryptToken(
      row.refreshTokenEncrypted,
    );
    const tokens = await this.googleOAuth.refreshAccessToken(refreshToken);
    await this.upsertFromOAuthTokens(userId, tokens);
    return tokens.accessToken;
  }

  async upsertFromOAuthTokens(
    userId: string,
    tokens: GoogleOAuthTokens,
  ): Promise<void> {
    const existing = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });

    if (!tokens.refreshToken && !existing) {
      throw new BadRequestException(
        'Google did not return a refresh token. Disconnect and reconnect with consent.',
      );
    }

    const refreshTokenEncrypted = tokens.refreshToken
      ? this.googleOAuth.encryptToken(tokens.refreshToken)
      : existing!.refreshTokenEncrypted;

    const accessTokenEncrypted = this.googleOAuth.encryptToken(
      tokens.accessToken,
    );
    const accessTokenExpiresAt =
      tokens.expiresIn != null
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null;

    await this.prisma.googleCalendarIntegration.upsert({
      where: { userId },
      create: {
        userId,
        refreshTokenEncrypted,
        accessTokenEncrypted,
        accessTokenExpiresAt,
      },
      update: {
        refreshTokenEncrypted,
        accessTokenEncrypted,
        accessTokenExpiresAt,
      },
    });
  }

  async disconnect(userId: string): Promise<void> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) return;

    try {
      const refreshToken = this.googleOAuth.decryptToken(
        row.refreshTokenEncrypted,
      );
      await this.googleOAuth.revokeToken(refreshToken);
    } catch {
      /* revoke best-effort */
    }

    await this.prisma.googleCalendarIntegration.delete({ where: { userId } });

    await this.prisma.task.deleteMany({
      where: { userId, source: TaskSource.google },
    });
  }
}
