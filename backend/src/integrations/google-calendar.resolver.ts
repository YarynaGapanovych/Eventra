import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import {
  clampSyncDaysBack,
  clampSyncDaysForward,
} from './google-calendar-sync-window';
import {
  GoogleCalendarConnectPayload,
  GoogleCalendarDisconnectPayload,
  GoogleCalendarStatus,
  GoogleCalendarSyncPayload,
  StartGoogleCalendarConnectInput,
  UpdateGoogleCalendarSyncWindowInput,
} from './google-calendar.types';

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver()
@UseGuards(GqlAuthGuard)
@UsePipes(gqlValidationPipe)
export class GoogleCalendarResolver {
  constructor(
    private readonly integrationService: GoogleCalendarIntegrationService,
    private readonly syncService: GoogleCalendarSyncService,
  ) {}

  @Query(() => GoogleCalendarStatus)
  googleCalendarStatus(
    @CurrentUser() user: JwtUser,
  ): Promise<GoogleCalendarStatus> {
    return this.integrationService.getStatus(user.userId);
  }

  @Mutation(() => GoogleCalendarConnectPayload)
  startGoogleCalendarConnect(
    @CurrentUser() user: JwtUser,
    @Args('input', { nullable: true })
    input?: StartGoogleCalendarConnectInput,
  ): GoogleCalendarConnectPayload {
    return this.integrationService.startConnect(
      user.userId,
      input?.redirectUri,
    );
  }

  @Mutation(() => GoogleCalendarDisconnectPayload)
  async disconnectGoogleCalendar(
    @CurrentUser() user: JwtUser,
  ): Promise<GoogleCalendarDisconnectPayload> {
    await this.integrationService.disconnect(user.userId);
    return { ok: true };
  }

  @Mutation(() => GoogleCalendarSyncPayload)
  async syncGoogleCalendar(
    @CurrentUser() user: JwtUser,
  ): Promise<GoogleCalendarSyncPayload> {
    const result = await this.syncService.syncForUser(user.userId);
    return { ok: true, syncedAt: result.syncedAt, imported: result.imported };
  }

  @Mutation(() => GoogleCalendarStatus)
  updateGoogleCalendarSyncWindow(
    @CurrentUser() user: JwtUser,
    @Args('input') input: UpdateGoogleCalendarSyncWindowInput,
  ): Promise<GoogleCalendarStatus> {
    return this.integrationService.updateSyncWindow(
      user.userId,
      clampSyncDaysBack(input.syncDaysBack),
      clampSyncDaysForward(input.syncDaysForward),
    );
  }
}
