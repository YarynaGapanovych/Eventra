import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { TasksModule } from '../tasks/tasks.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { AiResolver } from './ai.resolver';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule, TasksModule, EventsModule, UserSettingsModule],
  providers: [AiService, AiResolver],
})
export class AiModule {}
