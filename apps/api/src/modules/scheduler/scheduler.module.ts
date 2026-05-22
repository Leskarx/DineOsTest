import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, Shift, Tenant, User, PasswordResetToken])],
  providers: [SchedulerService],
})
export class SchedulerModule {}
