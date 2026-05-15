import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Worker');
  await NestFactory.createApplicationContext(AppModule);
  logger.log('Kafka consumer running (no HTTP server)');
}
bootstrap();
