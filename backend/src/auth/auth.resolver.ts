import { BadRequestException, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthService } from "./auth.service";
import { AuthPayload, AuthUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { GqlAuthGuard } from "./gql-auth.guard";
import type { JwtUser } from "./jwt-user";

const gqlValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

@Resolver()
@UsePipes(gqlValidationPipe)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  register(@Args("input") input: RegisterDto): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload)
  login(@Args("input") input: LoginDto): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Mutation(() => AuthPayload)
  completeGoogleLogin(@Args("code") code: string): Promise<AuthPayload> {
    if (!code?.trim()) {
      throw new BadRequestException("code is required");
    }
    return this.authService.completeGoogleExchange(code.trim());
  }

  @Query(() => AuthUser)
  @UseGuards(GqlAuthGuard)
  me(@CurrentUser() user: JwtUser): Promise<AuthUser> {
    return this.authService.me(user.userId);
  }
}
