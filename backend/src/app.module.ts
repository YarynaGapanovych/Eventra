import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { RootResolver } from './root.resolver';
import { EventsModule } from './events/events.module';
import { TasksModule } from './tasks/tasks.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { AiModule } from './ai/ai.module';

const isProd = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      path: '/graphql',
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: !isProd,
      introspection: !isProd,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    PrismaModule,
    AuthModule,
    IntegrationsModule,
    EventsModule,
    TasksModule,
    UserSettingsModule,
    AiModule,
  ],
  providers: [RootResolver],
})
export class AppModule {}
