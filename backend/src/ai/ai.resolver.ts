import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import { AiService } from './ai.service';
import { AssistantReply, AssistantThread } from './ai.types';

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver()
@UseGuards(GqlAuthGuard)
@UsePipes(gqlValidationPipe)
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Query(() => AssistantThread)
  assistantThread(@CurrentUser() user: JwtUser): Promise<AssistantThread> {
    return this.aiService.getThread(user.userId);
  }

  @Mutation(() => AssistantReply)
  askAssistant(
    @CurrentUser() user: JwtUser,
    @Args('content') content: string,
  ): Promise<AssistantReply> {
    return this.aiService.ask(user.userId, content);
  }

  @Mutation(() => Boolean)
  resetAssistantThread(@CurrentUser() user: JwtUser): Promise<boolean> {
    return this.aiService.resetThread(user.userId);
  }
}
