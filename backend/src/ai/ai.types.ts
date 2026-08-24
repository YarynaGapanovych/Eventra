import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AssistantMessage {
  @Field()
  id!: string;

  @Field()
  role!: string;

  @Field()
  content!: string;

  @Field()
  createdAt!: string;
}

@ObjectType()
export class AssistantThread {
  @Field(() => [AssistantMessage])
  messages!: AssistantMessage[];

  @Field(() => String, { nullable: true })
  expiresAt!: string | null;
}

@ObjectType()
export class AssistantReply {
  @Field()
  content!: string;

  @Field()
  didMutate!: boolean;
}
