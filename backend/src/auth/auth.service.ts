import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthPayload as AuthPayloadGql } from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
