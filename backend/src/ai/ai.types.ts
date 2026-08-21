import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class AssistantMessageInput {
  @Field()
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: string;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

@ObjectType()
export class AssistantReply {
  @Field()
  content!: string;

  @Field()
  didMutate!: boolean;
}
