import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type JwtUser = {
  userId: string;
  email?: string;
};

export function extractJwtUser(
  jwtService: JwtService,
  authorization?: string,
): JwtUser {
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
  if (!token) {
    throw new UnauthorizedException();
  }
  let payload: { sub?: string; email?: string };
  try {
    payload = jwtService.verify(token);
  } catch {
    throw new UnauthorizedException();
  }
  if (!payload.sub) {
    throw new UnauthorizedException();
  }
  return { userId: payload.sub, email: payload.email };
}

export function authorizationFromRequest(req?: {
  headers?: Record<string, unknown>;
}): string | undefined {
  const value = req?.headers?.authorization ?? req?.headers?.Authorization;
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}
