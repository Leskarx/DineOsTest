import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KdsService } from './kds.service';
import { KdsController } from './kds.controller';
import { OrderItem } from '../orders/entities/order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OrderItem])],
  providers: [KdsService],
  controllers: [KdsController],
})
export class KdsModule {}
