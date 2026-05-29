import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId } from '../common/decorators/tenant.decorator';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly svc: ReportsService) { }

  @Get('dashboard')
  @Roles('cashier', 'manager', 'owner', 'restaurant_manager')
  @ApiOperation({ summary: 'Live dashboard summary stats' })
  dashboard(@TenantId() t: string, @BranchId() b: string) {
    return this.svc.getDashboardSummary(b, t);
  }

  @Get('hotel-dashboard')
  @Roles('manager', 'owner', 'hotel_manager')
  @ApiOperation({ summary: 'Live hotel sales dashboard stats' })
  hotelDashboard(@TenantId() t: string, @BranchId() b: string) { return this.svc.getHotelDashboardSummary(b, t); }

  @Get('owner-dashboard')
  @Roles('owner', 'manager')
  @ApiOperation({ summary: 'Executive owner dashboard — combined POS + Hotel' })
  ownerDashboard(@TenantId() t: string, @BranchId() b: string) { return this.svc.getOwnerDashboardSummary(b, t); }

  @Get('hourly')
  @Roles('cashier', 'manager', 'owner', 'restaurant_manager')
  @ApiOperation({ summary: 'Hourly sales breakdown for a given date' })
  hourly(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('date') date: string,
  ) {
    return this.svc.getHourlyReport(b, t, date);
  }

  @Get('daily-sales')
  @Roles('manager', 'owner', 'restaurant_manager', 'hotel_manager')
  @ApiOperation({ summary: 'Daily sales report (date range)' })
  dailySales(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getDailySales(b, t, from, to);
  }

  @Get('items')
  @Roles('manager', 'owner', 'restaurant_manager')
  @ApiOperation({ summary: 'Item-level sales report' })
  itemSales(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getItemSalesReport(b, t, from, to);
  }

  @Get('payments')
  @Roles('manager', 'owner', 'restaurant_manager', 'hotel_manager')
  @ApiOperation({ summary: 'Payment method breakdown' })
  payments(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getPaymentMethodReport(b, t, from, to);
  }

  @Get('categories')
  @Roles('manager', 'owner', 'restaurant_manager')
  @ApiOperation({ summary: 'Revenue by category' })
  categories(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getCategoryReport(b, t, from, to);
  }

  @Get('gst')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Monthly GST summary (GSTR-1/3B ready)' })
  gst(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getGstReport(b, t, from, to);
  }

  @Get('gstr1-export')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'GSTR-1 JSON export for GST portal filing' })
  async gstr1Export(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const data = await this.svc.getGstr1Export(b, t, from, to);
    const filename = `GSTR1_${from}_${to}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }

  @Get('shifts')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Shift-wise sales report' })
  shifts(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getShiftReport(b, t, from, to);
  }

  @Get('waiters')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Waiter-wise performance report' })
  waiters(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getWaiterReport(b, t, from, to);
  }

  @Get('branch-performance')
  @Roles('owner')
  @ApiOperation({ summary: 'Cross-branch revenue & order performance (owner only)' })
  branchPerformance(
    @TenantId() t: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.svc.getBranchPerformance(t, from, to);
  }

  @Get('branch-summary')
  @Roles('owner', 'manager', 'restaurant_manager', 'hotel_manager')
  @ApiOperation({ summary: 'Single-branch combined summary for branch managers' })
  branchSummary(
    @TenantId() t: string,
    @BranchId() b: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getBranchSummary(b, t, from, to);
  }
}