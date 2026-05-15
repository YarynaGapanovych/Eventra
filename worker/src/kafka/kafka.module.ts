import { Module } from '@nestjs/common';
import { TaskConsumerService } from './task-consumer.service';

@Module({
  providers: [TaskConsumerService],
})
export class KafkaModule {}
