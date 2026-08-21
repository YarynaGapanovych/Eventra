import { Field, InputType } from "@nestjs/graphql";
import { IsString, MinLength } from "class-validator";

@InputType("ResetPasswordInput")
export class ResetPasswordDto {
  @Field()
  @IsString()
  @MinLength(1)
  token!: string;

  @Field()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password!: string;
}
