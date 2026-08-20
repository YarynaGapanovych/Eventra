import { BadRequestException } from '@nestjs/common';

export const DEFAULT_FRONTEND_REDIRECT =
  'http://localhost:3000/settings?google_calendar=callback';

export const ALLOWED_REDIRECT_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

export function validateCalendarRedirectUri(uri: string): string {
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
