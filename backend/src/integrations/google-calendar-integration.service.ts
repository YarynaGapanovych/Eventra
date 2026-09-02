import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventSource, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_FRONTEND_REDIRECT,
  validateCalendarRedirectUri,
} from './google-calendar-redirect';
import {
  DEFAULT_SYNC_DAYS_BACK,
  DEFAULT_SYNC_DAYS_FORWARD,
} from './google-calendar-sync-window';
import {
  parseOverlapNotices,
  type CalendarOverlapNotice,
} from './google-calendar.types';
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
  pendingOverlaps: CalendarOverlapNotice[];
};

@Injectable()
export class GoogleCalendarIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  startConnect(
    userId: string,
    redirectUri?: string,
  ): { connectUrl: string } {
    const safeRedirect = validateCalendarRedirectUri(
      redirectUri?.trim() || DEFAULT_FRONTEND_REDIRECT,
    );
    const exchange = this.jwtService.sign(
      { sub: userId, purpose: 'calendar_connect', redirectUri: safeRedirect },
      { expiresIn: '2m' },
    );
    const port = this.config.get<string>('PORT') ?? '3001';
    const apiBase =
      this.config.get<string>('API_PUBLIC_URL')?.trim() ||
      `http://localhost:${port}`;
    const connectUrl = new URL(
      `${apiBase.replace(/\/$/, '')}/integrations/google-calendar/connect`,
    );
    connectUrl.searchParams.set('exchange', exchange);
    connectUrl.searchParams.set('redirect_uri', safeRedirect);
    return { connectUrl: connectUrl.toString() };
  }

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
        pendingOverlaps: [],
      };
    }
    return {
      connected: true,
      connectedAt: row.connectedAt.toISOString(),
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      syncDaysBack: row.syncDaysBack,
      syncDaysForward: row.syncDaysForward,
      pendingOverlaps: parseOverlapNotices(row.pendingOverlapNotices),
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

  async mergePendingOverlapNotices(
    userId: string,
    notices: CalendarOverlapNotice[],
  ): Promise<CalendarOverlapNotice[]> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) return notices;

    const merged = new Map<string, CalendarOverlapNotice>();
    for (const notice of parseOverlapNotices(row.pendingOverlapNotices)) {
      merged.set(notice.id, notice);
    }
    for (const notice of notices) {
      merged.set(notice.id, notice);
    }
    const next = [...merged.values()];
    await this.prisma.googleCalendarIntegration.update({
      where: { userId },
      data: {
        pendingOverlapNotices: next as Prisma.InputJsonValue,
      },
    });
    return next;
  }

  async acknowledgeOverlapNotices(userId: string): Promise<boolean> {
    const row = await this.prisma.googleCalendarIntegration.findUnique({
      where: { userId },
    });
    if (!row) return false;
    await this.prisma.googleCalendarIntegration.update({
      where: { userId },
      data: { pendingOverlapNotices: [] as Prisma.InputJsonValue },
    });
    return true;
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

    await this.prisma.event.deleteMany({
      where: { userId, source: EventSource.google },
    });
  }
}
