import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import {
  CreateEventInput,
  Event,
  ScheduleTaskInput,
  UpdateEventInput,
} from './event.types';
import { EventsService } from './events.service';

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver(() => Event)
@UseGuards(GqlAuthGuard)
@UsePipes(gqlValidationPipe)
export class EventsResolver {
  constructor(private readonly eventsService: EventsService) {}

  @Query(() => [Event])
  events(@CurrentUser() user: JwtUser): Promise<Event[]> {
    return this.eventsService.listForUser(user.userId);
  }

  @Mutation(() => Event)
  createEvent(
    @CurrentUser() user: JwtUser,
    @Args('input') input: CreateEventInput,
  ): Promise<Event> {
    return this.eventsService.createForUser(user.userId, input);
  }

  @Mutation(() => Event)
  updateEvent(
    @CurrentUser() user: JwtUser,
    @Args('id') id: string,
    @Args('input') input: UpdateEventInput,
  ): Promise<Event> {
    return this.eventsService.updateForUser(user.userId, id, input);
  }

  @Mutation(() => Boolean)
  deleteEvent(
    @CurrentUser() user: JwtUser,
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.eventsService.deleteForUser(user.userId, id);
  }

  @Mutation(() => Event)
  scheduleTask(
    @CurrentUser() user: JwtUser,
    @Args('input') input: ScheduleTaskInput,
  ): Promise<Event> {
    return this.eventsService.scheduleTaskForUser(user.userId, input);
  }
}
