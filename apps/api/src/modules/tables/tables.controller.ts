import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId } from '../common/decorators/tenant.decorator';
import { TablesService } from './tables.service';
import { Table } from './entities/table.entity';
import { TableSection } from './entities/table-section.entity';

@ApiTags('tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'tables', version: '1' })
export class TablesController {
  constructor(private readonly svc: TablesService) {}

  // ── Sections (must come before :id routes to avoid param conflicts) ────────

  @Get('sections')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'List sections for the current branch' })
  listSections(@TenantId() t: string, @BranchId() b: string) {
    return this.svc.findAllSections(b, t);
  }

  @Post('sections')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create table section (manager/owner)' })
  createSection(
    @Body() body: Partial<TableSection>,
    @TenantId() t: string,
    @BranchId() b: string,
  ) {
    return this.svc.createSection({ ...body, tenantId: t, branchId: b || body.branchId });
  }

  @Put('sections/:id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Update table section (manager/owner)' })
  updateSection(
    @Param('id') id: string,
    @Body() body: Partial<TableSection>,
    @TenantId() t: string,
  ) {
    return this.svc.updateSection(id, t, body);
  }

  @Delete('sections/:id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Delete table section — must be empty (manager/owner)' })
  removeSection(@Param('id') id: string, @TenantId() t: string) {
    return this.svc.removeSection(id, t);
  }

  // ── Tables ─────────────────────────────────────────────────────────────────

  @Get()
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'List tables for the current branch' })
  findAll(@TenantId() t: string, @BranchId() b: string) {
    return this.svc.findAll(b, t);
  }

  @Get(':id')
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  findOne(@Param('id') id: string, @TenantId() t: string) {
    return this.svc.findOne(id, t);
  }

  @Post()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Create table (manager/owner)' })
  create(
    @Body() body: Partial<Table>,
    @TenantId() t: string,
    @BranchId() b: string,
  ) {
    return this.svc.create({ ...body, tenantId: t, branchId: b || body.branchId });
  }

  @Put(':id')
  @Roles('waiter', 'cashier', 'manager', 'owner')
  @ApiOperation({ summary: 'Update table (name, capacity, status, section)' })
  update(
    @Param('id') id: string,
    @Body() body: Partial<Table>,
    @TenantId() t: string,
  ) {
    return this.svc.update(id, t, body);
  }

  @Delete(':id')
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'Soft-delete table (manager/owner)' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
