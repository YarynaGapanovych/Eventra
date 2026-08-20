import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import {
  authorizationFromRequest,
  extractJwtUser,
  type JwtUser,
} from './jwt-user';

type GqlRequest = {
  headers?: Record<string, unknown>;
  user?: JwtUser;
};

@Injectable()
export class GqlAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext<{ req: GqlRequest }>().req;
    req.user = extractJwtUser(
      this.jwtService,
      authorizationFromRequest(req),
    );
    return true;
  }
}
