import { BadRequestException } from '@nestjs/common';

const LOCAL_FRONTEND_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export function allowedFrontendOrigins(): string[] {
  const origins = new Set<string>(LOCAL_FRONTEND_ORIGINS);
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) {
    try {
      origins.add(new URL(frontend).origin);
    } catch {
      /* ignore invalid FRONTEND_URL */
    }
  }
  return [...origins];
}

export function defaultFrontendOrigin(): string {
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) {
    try {
      return new URL(frontend).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://localhost:3000';
}

export function validateFrontendRedirectUri(uri: string): string {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new BadRequestException('redirect_uri is invalid');
  }
  if (!allowedFrontendOrigins().includes(url.origin)) {
    throw new BadRequestException('redirect_uri origin is not allowed');
  }
  return url.toString();
}
