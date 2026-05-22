import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders.gateway';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { MenuItemVariation } from '../menu/entities/menu-item-variation.entity';
import { GstRate } from '../billing/entities/gst-rate.entity';
import { Table } from '../tables/entities/table.entity';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Plan } from '../subscriptions/entities/plan.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule is imported so JwtService is available for WebSocket JWT verification
  imports: [AuthModule, TypeOrmModule.forFeature([Order, OrderItem, MenuItem, MenuItemVariation, GstRate, Table, Subscription, Plan])],
  providers: [OrdersService, OrdersGateway, SubscriptionGuard],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
