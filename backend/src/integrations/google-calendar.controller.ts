import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';

@Controller('integrations/google-calendar')
export class GoogleCalendarController {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('connect')
  connect(
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ): void {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId?.trim()) {
      throw new ServiceUnavailableException(
        'Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_ID in backend/.env.',
      );
    }
    if (!redirectUri?.trim()) {
      throw new BadRequestException('redirect_uri is required');
    }

    const port = this.config.get<string>('PORT') ?? '3001';
    const callbackUri =
      this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI') ??
      `http://localhost:${port}/integrations/google-calendar/callback`;

    const state = Buffer.from(
      JSON.stringify({ redirectUri: redirectUri.trim() }),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId.trim(),
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
  callback(
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): void {
    let redirectUri = 'http://localhost:3000/settings';
    try {
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as { redirectUri?: string };
      if (parsed.redirectUri?.trim()) {
        redirectUri = parsed.redirectUri.trim();
      }
    } catch {
      /* use default */
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

    // TODO: exchange authorization code for tokens and persist per user.
    url.searchParams.set('google_calendar', 'connected');
    res.redirect(url.toString());
  }

  @Post('sync')
  sync(@Headers('authorization') authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null;
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException();
    }

    return { ok: true, syncedAt: new Date().toISOString() };
  }
}
