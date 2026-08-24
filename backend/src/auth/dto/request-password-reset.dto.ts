import { Field, InputType } from "@nestjs/graphql";
import { IsEmail } from "class-validator";

@InputType("RequestPasswordResetInput")
export class RequestPasswordResetDto {
  @Field()
  @IsEmail()
  email!: string;
}
