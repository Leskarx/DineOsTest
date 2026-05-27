import { Controller, Get, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
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
  // Cached for 60s: fires 7 raw SQL queries — too expensive to run on every page render.
  @Get('dashboard')
  @Roles('cashier', 'manager', 'owner')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(60)
  @ApiOperation({ summary: 'Live dashboard summary stats (cached 60s)' })
  dashboard(@TenantId() t: string, @BranchId() b: string) { return this.svc.getDashboardSummary(b, t); }

  @Get('hourly')
  @Roles('cashier', 'manager', 'owner')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(30)
  @ApiOperation({ summary: 'Hourly sales breakdown for a given date (cached 30s)' })
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
