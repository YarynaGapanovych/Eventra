import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/current-user.decorator';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import type { JwtUser } from '../auth/jwt-user';
import { AiService } from './ai.service';
import { AssistantMessageInput, AssistantReply } from './ai.types';

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

  @Mutation(() => AssistantReply)
  askAssistant(
    @CurrentUser() user: JwtUser,
    @Args('messages', { type: () => [AssistantMessageInput] })
    messages: AssistantMessageInput[],
  ): Promise<AssistantReply> {
    return this.aiService.ask(user.userId, messages);
  }
}
