import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { GoogleCalendarResolver } from './google-calendar.resolver';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { GoogleOAuthService } from './google-oauth.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [GoogleCalendarController],
  providers: [
    GoogleOAuthService,
    GoogleCalendarIntegrationService,
    GoogleCalendarSyncService,
    GoogleCalendarResolver,
  ],
  exports: [
    GoogleOAuthService,
    GoogleCalendarIntegrationService,
    GoogleCalendarSyncService,
  ],
})
export class IntegrationsModule {}
