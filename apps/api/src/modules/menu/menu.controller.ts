import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId } from '../common/decorators/tenant.decorator';
import { MenuService } from './menu.service';
import { MenuItem } from './entities/menu-item.entity';
import { Category } from './entities/category.entity';

@ApiTags('menu')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'menu', version: '1' })
export class MenuController {
  constructor(private readonly svc: MenuService) {}

  // ── Categories — all staff read; manager/owner write ─────────

  @Get('categories')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300)
  @ApiOperation({ summary: 'List categories (cached 5 min)' })
  getCategories(@TenantId() t: string, @BranchId() b: string) { return this.svc.getCategories(t, b); }

  @Post('categories')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create menu category (manager/owner only)' })
  createCategory(@Body() body: Partial<Category>, @TenantId() t: string, @BranchId() b: string) {
    return this.svc.createCategory({ ...body, tenantId: t, branchId: b });
  }

  // ── Items — all staff read; manager/owner write ───────────────

  @Get('items')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(120)
  @ApiOperation({ summary: 'List menu items (cached 2 min)' })
  getItems(@TenantId() t: string, @BranchId() b: string, @Query('categoryId') cat?: string) {
    return this.svc.getItems(t, b, cat);
  }

  @Get('items/:id')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  getItem(@Param('id') id: string, @TenantId() t: string) { return this.svc.getItem(id, t); }

  @Post('items')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create menu item (manager/owner only)' })
  createItem(@Body() body: Partial<MenuItem>, @TenantId() t: string, @BranchId() b: string) {
    return this.svc.createItem({ ...body, tenantId: t, branchId: b });
  }

  @Put('items/:id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Update menu item (manager/owner only)' })
  updateItem(@Param('id') id: string, @Body() body: Partial<MenuItem>, @TenantId() t: string) {
    return this.svc.updateItem(id, t, body);
  }

  @Delete('items/:id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Delete menu item (manager/owner only)' })
  removeItem(@Param('id') id: string) { return this.svc.removeItem(id); }

  // ── Variations ────────────────────────────────────────────────

  @Get('items/:id/variations')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'List active variations for a menu item' })
  getVariations(@Param('id') id: string, @TenantId() t: string) {
    return this.svc.getVariations(id, t);
  }

  @Post('items/:id/variations')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Add a variation to a menu item (manager/owner only)' })
  createVariation(@Param('id') id: string, @Body() body: any, @TenantId() t: string) {
    return this.svc.createVariation(id, t, body);
  }

  @Put('items/:itemId/variations/:varId')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Update a variation (manager/owner only)' })
  updateVariation(@Param('varId') varId: string, @Body() body: any, @TenantId() t: string) {
    return this.svc.updateVariation(varId, t, body);
  }

  @Delete('items/:itemId/variations/:varId')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Delete a variation (manager/owner only)' })
  removeVariation(@Param('varId') varId: string, @TenantId() t: string) {
    return this.svc.removeVariation(varId, t);
  }

  // ── GST Rates ─────────────────────────────────────────────────

  @Get('gst-rates')
  @Roles('cashier', 'manager', 'owner')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(1800)
  @ApiOperation({ summary: 'List GST rates (cached 30 min)' })
  getGstRates(@TenantId() t: string) { return this.svc.getGstRates(t); }

  @Post('gst-rates/seed')
  @Roles('owner')
  @ApiOperation({ summary: 'Seed default India GST slabs (owner only, run once)' })
  seedGstRates(@TenantId() t: string) { return this.svc.seedDefaultGstRates(t); }
}
