import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GqlAuthGuard } from './gql-auth.guard';
import { GoogleAuthController } from './google-auth.controller';
import {
  ConsolePasswordResetMailer,
  PASSWORD_RESET_MAILER,
} from './password-reset-mailer';
import { ResendPasswordResetMailer } from './resend-password-reset-mailer';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ?? 'eventra-dev-secret-change-me',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [GoogleAuthController],
  providers: [
    AuthService,
    AuthResolver,
    GqlAuthGuard,
    {
      provide: PASSWORD_RESET_MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
        if (apiKey) {
          return new ResendPasswordResetMailer(config);
        }
        return new ConsolePasswordResetMailer();
      },
    },
  ],
  exports: [AuthService, JwtModule, GqlAuthGuard],
})
export class AuthModule {}
