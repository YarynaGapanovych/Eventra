import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import { UserSettingsService } from './user-settings.service';
import {
  UpdateUserSettingsInput,
  UserSettings,
} from './user-settings.types';

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver(() => UserSettings)
@UseGuards(GqlAuthGuard)
@UsePipes(gqlValidationPipe)
export class UserSettingsResolver {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Query(() => UserSettings)
  userSettings(@CurrentUser() user: JwtUser): Promise<UserSettings> {
    return this.userSettingsService.getOrCreateForUser(user.userId);
  }

  @Mutation(() => UserSettings)
  updateUserSettings(
    @CurrentUser() user: JwtUser,
    @Args('input') input: UpdateUserSettingsInput,
  ): Promise<UserSettings> {
    return this.userSettingsService.updateForUser(user.userId, input);
  }
}
