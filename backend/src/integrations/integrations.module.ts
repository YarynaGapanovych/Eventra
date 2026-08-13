import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GoogleCalendarController } from "./google-calendar.controller";

@Module({
  imports: [AuthModule],
  controllers: [GoogleCalendarController],
})
export class IntegrationsModule {}
