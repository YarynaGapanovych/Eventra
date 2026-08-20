import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsResolver } from './events.resolver';
import { EventsService } from './events.service';

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [EventsService, EventsResolver],
  exports: [EventsService],
})
export class EventsModule {}
