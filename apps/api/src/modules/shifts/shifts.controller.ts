import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId, CurrentUser } from '../common/decorators/tenant.decorator';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto, CloseShiftDto } from './dto/shift.dto';

@ApiTags('shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'shifts', version: '1' })
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) { }

  @Post('open')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({
    summary: 'Open a new shift',
    description: 'Cashier enters opening cash amount (simple input, no denominations)'
  })
  @ApiResponse({ status: 201, description: 'Shift opened successfully' })
  @ApiResponse({ status: 400, description: 'A shift is already open for this branch' })
  async openShift(
    @Body() openShiftDto: OpenShiftDto,
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
    @CurrentUser() user: any,
  ) {
    const shift = await this.svc.openShift(
      branchId,
      tenantId,
      user.id,
      openShiftDto.openingCash,
      openShiftDto.denominations // Optional denominations at opening
    );

    return {
      success: true,
      data: shift,
      message: 'Shift opened successfully'
    };
  }

  @Post(':id/close')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({
    summary: 'Close shift with denomination counting',
    description: 'Cashier counts physical cash and enters denomination breakdown for audit trail'
  })
  @ApiResponse({ status: 200, description: 'Shift closed successfully' })
  @ApiResponse({ status: 404, description: 'Open shift not found' })
  async closeShift(
    @Param('id') id: string,
    @Body() closeShiftDto: CloseShiftDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    const shift = await this.svc.closeShift(
      id,
      tenantId,
      user.id,
      closeShiftDto.closingCash,
      closeShiftDto.denominations,
      closeShiftDto.notes
    );

    return {
      success: true,
      data: shift,
      message: 'Shift closed successfully'
    };
  }

  @Get('current')
  @Roles('cashier', 'waiter', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({
    summary: 'Get current active shift (alias for /active)',
    description: 'Returns the currently open shift for the branch'
  })
  async getCurrent(@TenantId() tenantId: string, @BranchId() branchId: string) {
    const shift = await this.svc.getActiveShift(branchId, tenantId);
    return {
      success: true,
      data: shift
    };
  }

  @Get('active')
  @Roles('cashier', 'waiter', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({
    summary: 'Get active shift',
    description: 'Returns the currently open shift for the branch'
  })
  async getActive(@TenantId() tenantId: string, @BranchId() branchId: string) {
    const shift = await this.svc.getActiveShift(branchId, tenantId);
    return {
      success: true,
      data: shift
    };
  }

  @Get(':id/summary')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({
    summary: 'Get shift summary',
    description: 'Returns complete shift details including payment breakdown, GST, and cash reconciliation'
  })
  @ApiResponse({ status: 200, description: 'Shift summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Shift not found' })
  async getSummary(@Param('id') id: string, @TenantId() tenantId: string) {
    const summary = await this.svc.getShiftSummary(id, tenantId);
    return {
      success: true,
      data: summary
    };
  }

  @Get()
  @Roles('manager', 'owner')
  @ApiOperation({
    summary: 'List all shifts with filters',
    description: 'Returns shift history with proper columns: Shift ID, Opened By, Opening Cash, Cash Sales, Online Sales, Expected Cash, Actual Cash, Difference, Status'
  })
  @ApiResponse({ status: 200, description: 'Shifts retrieved successfully' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'closed'] })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-01-31' })
  @ApiQuery({ name: 'shiftNumber', required: false, type: String })
  async list(
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('shiftNumber') shiftNumber?: string,
  ) {
    const filters = {
      status,
      startDate,
      endDate,
      shiftNumber
    };

    const shifts = await this.svc.listShifts(
      branchId,
      tenantId,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
      filters
    );

    return {
      success: true,
      data: shifts,
      pagination: {
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
        total: shifts.length
      }
    };
  }

  @Get('stats/summary')
  @Roles('manager', 'owner')
  @ApiOperation({
    summary: 'Get shift statistics',
    description: 'Returns aggregated statistics for closed shifts'
  })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getStats(
    @TenantId() tenantId: string,
    @BranchId() branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.svc.getShiftStats(
      branchId,
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return {
      success: true,
      data: stats
    };
  }

  @Post(':id/refresh')
  @Roles('manager', 'owner')
  @ApiOperation({
    summary: 'Refresh shift calculations',
    description: 'Recalculates expected cash and difference based on current sales data'
  })
  async refreshShift(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    // Get the shift
    const shift = await this.svc.getShiftSummary(id, tenantId);

    // Recalculate expected cash
    const openingCash = Number(shift.openingCash);
    const cashSales = Number(shift.cashSales);
    const totalRefund = Number(shift.totalRefund || 0);
    const expectedCash = openingCash + cashSales - totalRefund;
    // Use closingCash (actualCash doesn't exist in entity)
    const actualCash = Number(shift.closingCash || 0);
    const difference = actualCash - expectedCash;

    return {
      success: true,
      data: {
        shiftId: id,
        openingCash,
        cashSales,
        totalRefund,
        expectedCash,
        actualCash,
        difference,
        message: difference >= 0 ? 'Surplus cash found' : 'Cash shortage detected'
      }
    };
  }
}