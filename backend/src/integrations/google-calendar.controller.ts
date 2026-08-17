import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import {
  clampSyncDaysBack,
  clampSyncDaysForward,
} from './google-calendar-sync-window';
import { GoogleOAuthService } from './google-oauth.service';

const DEFAULT_FRONTEND_REDIRECT =
  'http://localhost:3000/settings?google_calendar=callback';

const ALLOWED_REDIRECT_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly integrationService: GoogleCalendarIntegrationService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  @Post('start')
  start(
    @Headers('authorization') authorization: string | undefined,
    @Body('redirect_uri') redirectUri?: string,
  ) {
    const userId = this.requireUserId(authorization);
    const safeRedirect = this.validateRedirectUri(
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

  @Get('connect')
  connect(
    @Query('exchange') exchange: string,
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ): void {
    if (!exchange?.trim()) {
      throw new BadRequestException(
        'exchange is required. Call POST /integrations/google-calendar/start first.',
      );
    }

    const payload = this.verifyExchangeToken(exchange.trim());
    const safeRedirect = this.validateRedirectUri(
      redirectUri?.trim() || payload.redirectUri || DEFAULT_FRONTEND_REDIRECT,
    );

    const state = this.jwtService.sign(
      { sub: payload.sub, purpose: 'calendar_oauth_state', redirectUri: safeRedirect },
      { expiresIn: '10m' },
    );

    const callbackUri = this.googleOAuth.getCalendarCallbackUri();
    const params = new URLSearchParams({
      client_id: this.googleOAuth.getClientId(),
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    res.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  }

  @Get('callback')
  async callback(
    @Query('state') state: string,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    let redirectUri = DEFAULT_FRONTEND_REDIRECT;
    let userId: string | null = null;

    try {
      const parsed = this.verifyStateToken(state);
      userId = parsed.sub ?? null;
      redirectUri = parsed.redirectUri ?? DEFAULT_FRONTEND_REDIRECT;
    } catch {
      const url = new URL(DEFAULT_FRONTEND_REDIRECT);
      url.searchParams.set('google_calendar', 'error');
      url.searchParams.set('message', 'invalid_oauth_state');
      res.redirect(url.toString());
      return;
    }

    const url = new URL(redirectUri);

    if (error) {
      url.searchParams.set('google_calendar', 'error');
      url.searchParams.set(
        'message',
        errorDescription?.trim() || error || 'authorization_denied',
      );
      res.redirect(url.toString());
      return;
    }

    if (!code?.trim() || !userId) {
      url.searchParams.set('google_calendar', 'error');
      url.searchParams.set('message', 'missing_authorization_code');
      res.redirect(url.toString());
      return;
    }

    try {
      const tokens = await this.googleOAuth.exchangeCodeForTokens(
        code.trim(),
        this.googleOAuth.getCalendarCallbackUri(),
      );
      await this.integrationService.upsertFromOAuthTokens(userId, tokens);
      try {
        await this.syncService.syncForUser(userId);
      } catch (syncErr) {
        this.logger.warn(
          `Google Calendar connected for ${userId} but initial sync failed: ${
            syncErr instanceof Error ? syncErr.message : String(syncErr)
          }`,
        );
      }
      url.searchParams.set('google_calendar', 'connected');
      res.redirect(url.toString());
    } catch (err) {
      url.searchParams.set('google_calendar', 'error');
      url.searchParams.set(
        'message',
        err instanceof Error ? err.message : 'google_calendar_connect_failed',
      );
      res.redirect(url.toString());
    }
  }

  @Get('status')
  async status(@Headers('authorization') authorization?: string) {
    const userId = this.requireUserId(authorization);
    return this.integrationService.getStatus(userId);
  }

  @Post('disconnect')
  async disconnect(@Headers('authorization') authorization?: string) {
    const userId = this.requireUserId(authorization);
    await this.integrationService.disconnect(userId);
    return { ok: true };
  }

  @Post('sync')
  async sync(@Headers('authorization') authorization?: string) {
    const userId = this.requireUserId(authorization);
    const result = await this.syncService.syncForUser(userId);
    return { ok: true, syncedAt: result.syncedAt, imported: result.imported };
  }

  @Patch('sync-window')
  async updateSyncWindow(
    @Headers('authorization') authorization: string | undefined,
    @Body() body?: { syncDaysBack?: number; syncDaysForward?: number },
  ) {
    const userId = this.requireUserId(authorization);
    return this.integrationService.updateSyncWindow(
      userId,
      clampSyncDaysBack(body?.syncDaysBack),
      clampSyncDaysForward(body?.syncDaysForward),
    );
  }

  private requireUserId(authorization?: string): string {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;
    if (!token) {
      throw new UnauthorizedException();
    }
    let payload: { sub?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return payload.sub;
  }

  private verifyExchangeToken(exchange: string): {
    sub: string;
    redirectUri?: string;
  } {
    let payload: { sub?: string; purpose?: string; redirectUri?: string };
    try {
      payload = this.jwtService.verify(exchange);
    } catch {
      throw new BadRequestException('Invalid or expired connect token');
    }
    if (payload.purpose !== 'calendar_connect' || !payload.sub) {
      throw new BadRequestException('Invalid or expired connect token');
    }
    return { sub: payload.sub, redirectUri: payload.redirectUri };
  }

  private verifyStateToken(state: string): {
    sub?: string;
    redirectUri?: string;
  } {
    let payload: { sub?: string; purpose?: string; redirectUri?: string };
    try {
      payload = this.jwtService.verify(state);
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    if (payload.purpose !== 'calendar_oauth_state' || !payload.sub) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }
    return { sub: payload.sub, redirectUri: payload.redirectUri };
  }

  private validateRedirectUri(uri: string): string {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      throw new BadRequestException('redirect_uri is invalid');
    }
    if (!ALLOWED_REDIRECT_ORIGINS.has(url.origin)) {
      throw new BadRequestException('redirect_uri origin is not allowed');
    }
    return url.toString();
  }
}
