import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  constructor(private readonly svc: ReportsService) {}

  // Dashboard summary — cashiers and above (needed for shift counter)
  @Get('dashboard')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Live dashboard summary stats' })
  dashboard(@TenantId() t: string, @BranchId() b: string) { return this.svc.getDashboardSummary(b, t); }

  @Get('hourly')
  @Roles('cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Hourly sales breakdown for a given date' })
  hourly(@TenantId() t: string, @BranchId() b: string, @Query('date') date: string) {
    return this.svc.getHourlyReport(b, t, date);
  }

  // Detailed reports — manager / owner only
  @Get('daily-sales')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Daily sales report (date range)' })
  dailySales(@TenantId() t: string, @BranchId() b: string, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getDailySales(b, t, from, to);
  }

  @Get('items')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Item-level sales report' })
  itemSales(@TenantId() t: string, @BranchId() b: string, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getItemSalesReport(b, t, from, to);
  }

  @Get('payments')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Payment method breakdown' })
  payments(@TenantId() t: string, @BranchId() b: string, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getPaymentMethodReport(b, t, from, to);
  }

  @Get('categories')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Revenue by category' })
  categories(@TenantId() t: string, @BranchId() b: string, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getCategoryReport(b, t, from, to);
  }

  @Get('gst')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Monthly GST summary (GSTR-1/3B ready)' })
  gst(@TenantId() t: string, @BranchId() b: string, @Query('from') from: string, @Query('to') to: string) {
    return this.svc.getGstReport(b, t, from, to);
  }
}
