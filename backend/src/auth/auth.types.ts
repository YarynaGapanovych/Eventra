import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class AuthUser {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  name!: string | null;
}

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => AuthUser)
  user!: AuthUser;
}
