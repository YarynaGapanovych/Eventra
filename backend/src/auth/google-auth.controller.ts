import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { GoogleCalendarIntegrationService } from '../integrations/google-calendar-integration.service';
import { GoogleCalendarSyncService } from '../integrations/google-calendar-sync.service';
import type { GoogleOAuthTokens } from '../integrations/google-oauth.service';
import { AuthService } from './auth.service';
import {
  defaultFrontendOrigin,
  validateFrontendRedirectUri,
} from './frontend-redirect';

/** Same scopes the Settings "Connect Google Calendar" flow asks for. */
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  email_verified?: boolean;
};

@Controller('auth/google')
export class GoogleAuthController {
  private readonly logger = new Logger(GoogleAuthController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly calendarIntegration: GoogleCalendarIntegrationService,
    private readonly calendarSync: GoogleCalendarSyncService,
  ) {}

  /**
   * `calendar=1` (sent by browsers that have linked Google Calendar) also asks
   * for Calendar access, so signing in renews an expired Calendar connection.
   */
  @Get('connect')
  connect(
    @Query('redirect_uri') redirectUri: string,
    @Query('calendar') calendar: string | undefined,
    @Res() res: Response,
  ): void {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId?.trim()) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID in backend/.env.',
      );
    }
    if (!redirectUri?.trim()) {
      throw new BadRequestException('redirect_uri is required');
    }

    const safeRedirect = validateFrontendRedirectUri(redirectUri.trim());

    const port = this.config.get<string>('PORT') ?? '3001';
    const callbackUri =
      this.config.get<string>('GOOGLE_AUTH_REDIRECT_URI') ??
      `http://localhost:${port}/auth/google/callback`;

    const withCalendar = calendar === '1';
    const state = Buffer.from(
      JSON.stringify({ redirectUri: safeRedirect, calendar: withCalendar }),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId.trim(),
      redirect_uri: callbackUri,
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        ...(withCalendar ? CALENDAR_SCOPES : []),
      ].join(' '),
      access_type: withCalendar ? 'offline' : 'online',
      prompt: 'select_account',
      state,
    });
    if (withCalendar) params.set('include_granted_scopes', 'true');

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
    if (this.isCalendarOAuthState(state)) {
      const params = new URLSearchParams();
      if (state) params.set('state', state);
      if (code) params.set('code', code);
      if (error) params.set('error', error);
      if (errorDescription) params.set('error_description', errorDescription);
      res.redirect(`/integrations/google-calendar/callback?${params.toString()}`);
      return;
    }

    const fallbackRedirect = `${defaultFrontendOrigin()}/auth/google/callback`;
    let redirectUri = fallbackRedirect;
    let withCalendar = false;
    try {
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as { redirectUri?: string; calendar?: boolean };
      withCalendar = parsed.calendar === true;
      if (parsed.redirectUri?.trim()) {
        try {
          redirectUri = validateFrontendRedirectUri(
            parsed.redirectUri.trim(),
          );
        } catch {
          const url = new URL(fallbackRedirect);
          url.searchParams.set('google_auth', 'error');
          url.searchParams.set('message', 'redirect_uri origin is not allowed');
          res.redirect(url.toString());
          return;
        }
      }
    } catch {
      /* use default */
    }

    const url = new URL(redirectUri);

    if (error) {
      url.searchParams.set('google_auth', 'error');
      url.searchParams.set(
        'message',
        errorDescription?.trim() || error || 'authorization_denied',
      );
      res.redirect(url.toString());
      return;
    }

    if (!code?.trim()) {
      url.searchParams.set('google_auth', 'error');
      url.searchParams.set('message', 'missing_authorization_code');
      res.redirect(url.toString());
      return;
    }

    try {
      const profile = await this.fetchGoogleProfile(code.trim());
      const authPayload = await this.authService.loginWithGoogleProfile({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      });
      if (withCalendar) {
        await this.renewCalendarAccess(authPayload.user.id, profile.tokens);
      }
      const exchangeCode = this.authService.signExchangeToken(
        authPayload.user.id,
      );
      url.searchParams.set('google_auth', 'success');
      url.searchParams.set('code', exchangeCode);
      res.redirect(url.toString());
    } catch (err) {
      url.searchParams.set('google_auth', 'error');
      url.searchParams.set(
        'message',
        err instanceof Error ? err.message : 'google_sign_in_failed',
      );
      res.redirect(url.toString());
    }
  }

  /**
   * Saves Calendar tokens from sign-in for users who already linked Google
   * Calendar (this also clears `needsReconnect`). Never blocks sign-in.
   */
  private async renewCalendarAccess(
    userId: string,
    tokens: GoogleOAuthTokens,
  ): Promise<void> {
    const grantedCalendar = (tokens.scope ?? '')
      .split(' ')
      .includes(CALENDAR_SCOPES[0]);
    if (!tokens.refreshToken || !grantedCalendar) return;
    try {
      const status = await this.calendarIntegration.getStatus(userId);
      if (!status.connected) return;
      await this.calendarIntegration.upsertFromOAuthTokens(userId, tokens);
    } catch (err) {
      this.logger.warn(
        `Could not renew Google Calendar access for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }
    void this.calendarSync.syncForUser(userId).catch((err: unknown) => {
      this.logger.warn(
        `Google Calendar sync after sign-in failed for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    });
  }

  private isCalendarOAuthState(state: string | undefined): boolean {
    if (!state?.trim()) return false;
    try {
      const payload = this.jwtService.verify<{ purpose?: string }>(state);
      return payload.purpose === 'calendar_oauth_state';
    } catch {
      return false;
    }
  }

  private getCallbackUri(): string {
    const port = this.config.get<string>('PORT') ?? '3001';
    return (
      this.config.get<string>('GOOGLE_AUTH_REDIRECT_URI') ??
      `http://localhost:${port}/auth/google/callback`
    );
  }

  private async fetchGoogleProfile(code: string): Promise<{
    googleId: string;
    email: string;
    name: string | null;
    tokens: GoogleOAuthTokens;
  }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.',
      );
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.getCallbackUri(),
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new BadRequestException(
        tokenData.error_description?.trim() ||
          tokenData.error ||
          'Failed to exchange Google authorization code',
      );
    }

    const profileRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    const profile = (await profileRes.json()) as GoogleUserInfo;
    if (!profileRes.ok || !profile.sub || !profile.email) {
      throw new BadRequestException('Could not load Google profile');
    }
    if (profile.email_verified === false) {
      throw new BadRequestException('Google email is not verified');
    }

    return {
      googleId: profile.sub,
      email: profile.email.trim().toLowerCase(),
      name: profile.name?.trim() || null,
      tokens: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token ?? null,
        expiresIn: tokenData.expires_in ?? null,
        scope: tokenData.scope ?? null,
        tokenType: tokenData.token_type ?? null,
      },
    };
  }
}
