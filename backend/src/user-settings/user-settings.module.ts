import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { UserSettingsResolver } from './user-settings.resolver';
import { UserSettingsService } from './user-settings.service';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [UserSettingsService, UserSettingsResolver],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
