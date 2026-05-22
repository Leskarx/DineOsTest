import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId, CurrentUser } from '../common/decorators/tenant.decorator';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './entities/inventory-item.entity';
import { TransactionType } from './entities/inventory-transaction.entity';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  // ── Read — inventory / manager / owner and above ──────────────
  @Get('items')
  @Roles('inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'List inventory items' })
  getItems(@TenantId() t: string, @BranchId() b: string) { return this.svc.getItems(t, b); }

  @Get('items/:id')
  @Roles('inventory', 'manager', 'owner')
  getItem(@Param('id') id: string, @TenantId() t: string) { return this.svc.getItem(id, t); }

  @Get('items/:id/ledger')
  @Roles('inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Transaction ledger for one item' })
  getLedger(@Param('id') id: string, @TenantId() t: string) { return this.svc.getLedger(id, t); }

  @Get('alerts')
  @Roles('inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Low-stock and out-of-stock alerts' })
  getLowStock(@TenantId() t: string, @BranchId() b: string) { return this.svc.getLowStockAlerts(t, b); }

  // ── Write — manager / owner only ─────────────────────────────
  @Post('items')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create inventory item' })
  createItem(@Body() body: Partial<InventoryItem>, @TenantId() t: string, @BranchId() b: string) {
    return this.svc.createItem({ ...body, tenantId: t, branchId: b });
  }

  @Put('items/:id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Update inventory item' })
  updateItem(@Param('id') id: string, @Body() body: Partial<InventoryItem>, @TenantId() t: string) {
    return this.svc.updateItem(id, t, body);
  }

  @Post('transactions')
  @Roles('inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Record stock transaction (purchase, adjustment, wastage…)' })
  recordTxn(
    @Body() body: { itemId: string; type: TransactionType; quantity: number; unitCost?: number; notes?: string },
    @TenantId() t: string, @BranchId() b: string, @CurrentUser() user: any,
  ) {
    return this.svc.recordTransaction(t, b, body.itemId, body.type, body.quantity, body.unitCost, body.notes, user.id);
  }
}
