import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../auth/guards/subscription.guard';
import { Roles, RequireFeature } from '../common/decorators/roles.decorator';
import { CurrentUser, TenantId, BranchId } from '../common/decorators/tenant.decorator';
import { OrdersService, CreateOrderDto, AddItemDto, ApplyDiscountDto } from './orders.service';
import { OrderStatus } from './entities/order.entity';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
@RequireFeature('pos')
@Controller({ path: 'orders', version: '1' })
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create new order' })
  create(@Body() dto: CreateOrderDto, @TenantId() tenantId: string, @BranchId() branchId: string) {
    return this.svc.createOrder({ ...dto, tenantId, branchId: branchId || dto.branchId });
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  findAll(
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(branchId, tenantId, status, limit ? parseInt(limit) : 100);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.findOne(id, tenantId);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add items to order (KOT)' })
  addItems(
    @Param('id') id: string,
    @Body() body: { items: AddItemDto[] },
    @TenantId() tenantId: string,
  ) {
    return this.svc.addItems(id, body.items, tenantId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrderStatus,
    @TenantId() tenantId: string,
  ) {
    return this.svc.updateStatus(id, status, tenantId);
  }

  @Patch(':id/discount')
  applyDiscount(
    @Param('id') id: string,
    @Body() dto: ApplyDiscountDto,
    @TenantId() tenantId: string,
  ) {
    return this.svc.applyDiscount(id, dto, tenantId);
  }

  @Patch('items/:itemId/void')
  @Roles('manager', 'owner')
  voidItem(
    @Param('itemId') itemId: string,
    @Body('reason') reason: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.voidItem(itemId, reason, tenantId);
  }
}
