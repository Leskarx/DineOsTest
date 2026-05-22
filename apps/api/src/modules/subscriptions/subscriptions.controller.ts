import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant.decorator';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}
  @Get('plans') getPlans() { return this.svc.getPlans(); }
  @Get('current') @ApiBearerAuth() @UseGuards(JwtAuthGuard) getCurrent(@TenantId() t: string) { return this.svc.getSubscription(t); }
  @Get('limits') @ApiBearerAuth() @UseGuards(JwtAuthGuard) getLimits(@TenantId() t: string) { return this.svc.checkLimits(t); }
}
