import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type GoogleOAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  scope: string | null;
  tokenType: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

@Injectable()
export class GoogleOAuthService {
  constructor(private readonly config: ConfigService) {}

  getCalendarCallbackUri(): string {
    const port = this.config.get<string>('PORT') ?? '3001';
    return (
      this.config.get<string>('GOOGLE_CALENDAR_REDIRECT_URI') ??
      `http://localhost:${port}/integrations/google-calendar/callback`
    );
  }

  getClientId(): string {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_ID in backend/.env.',
      );
    }
    return clientId;
  }

  private getClientSecret(): string {
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    if (!clientSecret) {
      throw new ServiceUnavailableException(
        'Google OAuth is not configured. Set GOOGLE_CLIENT_SECRET in backend/.env.',
      );
    }
    return clientSecret;
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<GoogleOAuthTokens> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(
        data.error_description?.trim() ||
          data.error ||
          'Failed to exchange Google authorization code',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresIn: data.expires_in ?? null,
      scope: data.scope ?? null,
      tokenType: data.token_type ?? null,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        grant_type: 'refresh_token',
      }),
    });

    const data = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(
        data.error_description?.trim() ||
          data.error ||
          'Failed to refresh Google access token',
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in ?? null,
      scope: data.scope ?? null,
      tokenType: data.token_type ?? null,
    };
  }

  async revokeToken(token: string): Promise<void> {
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text.trim() || 'Failed to revoke Google token');
    }
  }

  encryptToken(plaintext: string): string {
    const key = this.encryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  decryptToken(ciphertext: string): string {
    const key = this.encryptionKey();
    const buf = Buffer.from(ciphertext, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }

  private encryptionKey(): Buffer {
    const raw =
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY')?.trim() ??
      this.config.get<string>('JWT_SECRET')?.trim();
    if (!raw) {
      throw new ServiceUnavailableException(
        'Set GOOGLE_TOKEN_ENCRYPTION_KEY or JWT_SECRET for token encryption.',
      );
    }
    return createHash('sha256').update(raw).digest();
  }
}
