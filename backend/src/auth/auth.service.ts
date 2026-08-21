import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload as AuthPayloadGql } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import {
  PASSWORD_RESET_MAILER,
  type PasswordResetMailer,
} from './password-reset-mailer';

const PASSWORD_RESET_PURPOSE = 'password_reset';
const PASSWORD_RESET_EXPIRES_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(PASSWORD_RESET_MAILER)
    private readonly passwordResetMailer: PasswordResetMailer,
  ) {}

  async register(dto: RegisterDto): Promise<AuthPayloadGql> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = hashSync(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name?.trim() || null,
      },
    });

    return this.signTokens(user.id, user.email, user.name);
  }

  async login(dto: LoginDto): Promise<AuthPayloadGql> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.signTokens(user.id, user.email, user.name);
  }

  async loginWithGoogleProfile(profile: {
    googleId: string;
    email: string;
    name?: string | null;
  }): Promise<AuthPayloadGql> {
    const email = profile.email.trim().toLowerCase();
    const googleId = profile.googleId.trim();
    const name = profile.name?.trim() || null;

    const byGoogleId = await this.prisma.user.findUnique({
      where: { googleId },
    });
    if (byGoogleId) {
      return this.signTokens(byGoogleId.id, byGoogleId.email, byGoogleId.name);
    }

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      const linked = await this.prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId, name: byEmail.name ?? name },
      });
      return this.signTokens(linked.id, linked.email, linked.name);
    }

    const created = await this.prisma.user.create({
      data: { email, googleId, name },
    });
    return this.signTokens(created.id, created.email, created.name);
  }

  signExchangeToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'google_exchange' },
      { expiresIn: '2m' },
    );
  }

  async completeGoogleExchange(exchangeToken: string): Promise<AuthPayloadGql> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(exchangeToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired Google sign-in code');
    }
    if (payload.purpose !== 'google_exchange' || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired Google sign-in code');
    }
    return this.signTokensFromUserId(payload.sub);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<boolean> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return true;
    }

    const token = this.jwtService.sign(
      { sub: user.id, purpose: PASSWORD_RESET_PURPOSE },
      { expiresIn: '1h' },
    );
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashPasswordResetToken(token),
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL')?.trim() || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.passwordResetMailer.sendResetLink(user.email, resetUrl);

    return true;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<boolean> {
    const token = dto.token.trim();
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired reset link');
    }
    if (payload.purpose !== PASSWORD_RESET_PURPOSE || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user?.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now() ||
      !passwordResetHashesMatch(
        user.passwordResetTokenHash,
        hashPasswordResetToken(token),
      )
    ) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashSync(dto.password, 10),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return true;
  }

  async me(userId: string): Promise<AuthPayloadGql['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  private async signTokensFromUserId(userId: string): Promise<AuthPayloadGql> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.signTokens(user.id, user.email, user.name);
  }

  private signTokens(
    userId: string,
    email: string,
    name: string | null,
  ): AuthPayloadGql {
    const accessToken = this.jwtService.sign({ sub: userId, email });
    return {
      accessToken,
      user: { id: userId, email, name },
    };
  }
}

function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function passwordResetHashesMatch(stored: string, incoming: string): boolean {
  const storedBuf = Buffer.from(stored, 'hex');
  const incomingBuf = Buffer.from(incoming, 'hex');
  if (storedBuf.length !== incomingBuf.length) {
    return false;
  }
  return timingSafeEqual(storedBuf, incomingBuf);
}
