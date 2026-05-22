import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId, CurrentUser } from '../common/decorators/tenant.decorator';
import { ShiftsService, DenominationDto } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'shifts', version: '1' })
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}

  @Post('open')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Open a new shift (cashier/manager/owner)' })
  openShift(
    @Body() body: { openingCash: number; denominations?: DenominationDto },
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.openShift(branchId, tenantId, user.id, body.openingCash, body.denominations);
  }

  @Post(':id/close')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Close the current shift' })
  closeShift(
    @Param('id') id: string,
    @Body() body: { closingCash: number; denominations?: DenominationDto; notes?: string },
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.svc.closeShift(id, tenantId, user.id, body.closingCash, body.denominations, body.notes);
  }

  // /shifts/current — alias for /shifts/active (used by dashboard)
  @Get('current')
  @Roles('cashier', 'waiter', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Get active shift (alias for /active)' })
  getCurrent(@TenantId() tenantId: string, @BranchId() branchId: string) {
    return this.svc.getActiveShift(branchId, tenantId);
  }

  @Get('active')
  @Roles('cashier', 'waiter', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Get the currently open shift for this branch' })
  getActive(@TenantId() tenantId: string, @BranchId() branchId: string) {
    return this.svc.getActiveShift(branchId, tenantId);
  }

  @Get(':id/summary')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Shift summary with cash totals and payment breakdown' })
  getSummary(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.svc.getShiftSummary(id, tenantId);
  }

  @Get()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'List all shifts (manager/owner only)' })
  list(@TenantId() tenantId: string, @BranchId() branchId: string) {
    return this.svc.listShifts(branchId, tenantId);
  }
}
