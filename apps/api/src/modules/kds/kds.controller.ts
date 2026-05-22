import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId } from '../common/decorators/tenant.decorator';
import { KdsService } from './kds.service';
import { KdsStatus } from '../orders/entities/order-item.entity';

@ApiTags('kds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'kds', version: '1' })
export class KdsController {
  constructor(private readonly svc: KdsService) {}

  // Kitchen display — kitchen staff, cashiers, managers and above can view
  @Get('pending')
  @Roles('kitchen', 'cashier', 'waiter', 'manager', 'owner')
  @ApiOperation({ summary: 'Pending KDS items for kitchen display' })
  getPending(
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
  ) {
    return this.svc.getPendingItems(branchId, tenantId);
  }

  // Status updates — kitchen staff and above
  @Patch('items/:id/status')
  @Roles('kitchen', 'cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Update KDS item status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: KdsStatus,
    @TenantId() tenantId: string,
  ) {
    return this.svc.updateItemStatus(id, status, tenantId);
  }

  @Patch('items/:id/bump')
  @Roles('kitchen', 'cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Mark item as served and remove from display' })
  bump(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.bumpItem(id, tenantId);
  }

  // Recall — manager / owner only (re-opens a bumped item)
  @Patch('items/:id/recall')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Recall a bumped item (manager/owner only)' })
  recall(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.recallItem(id, tenantId);
  }
}
