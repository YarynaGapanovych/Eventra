import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

@InputType("RegisterInput")
export class RegisterDto {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  password!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  name?: string;
}
