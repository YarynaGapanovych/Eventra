import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hashSync, compareSync } from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthPayload as AuthPayloadGql } from "./auth.types";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";

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
      throw new ConflictException("An account with this email already exists");
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
    if (!user || !compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
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
