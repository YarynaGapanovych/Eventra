import { Query, Resolver } from "@nestjs/graphql";

@Resolver()
export class RootResolver {
  /** Placeholder query so the schema satisfies GraphQL root type rules. */
  @Query(() => String, { description: "Service liveness probe for GraphQL." })
  ping(): string {
    return "ok";
  }
}
