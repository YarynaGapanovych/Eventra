import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import {
  DEFAULT_FRONTEND_REDIRECT,
  validateCalendarRedirectUri,
} from './google-calendar-redirect';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  private readonly logger = new Logger(GoogleCalendarController.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly integrationService: GoogleCalendarIntegrationService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  @Get('connect')
  connect(
    @Query('exchange') exchange: string,
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ): void {
    if (!exchange?.trim()) {
      throw new BadRequestException(
        'exchange is required. Call startGoogleCalendarConnect first.',
      );
    }

    const payload = this.verifyExchangeToken(exchange.trim());
    const safeRedirect = validateCalendarRedirectUri(
      redirectUri?.trim() || payload.redirectUri || DEFAULT_FRONTEND_REDIRECT,
    );

    const state = this.jwtService.sign(
      {
        sub: payload.sub,
        purpose: 'calendar_oauth_state',
        redirectUri: safeRedirect,
      },
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
}
