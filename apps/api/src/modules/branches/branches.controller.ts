import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { BranchesService } from './branches.service';
import { Branch } from './entities/branch.entity';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly svc: BranchesService) {}

  @Get()
  @Roles('manager', 'owner')
  @ApiOperation({ summary: 'List all branches for this tenant' })
  findAll(@TenantId() t: string) { return this.svc.findAll(t); }

  @Get(':id')
  @Roles('manager', 'owner')
  findOne(@Param('id') id: string, @TenantId() t: string) { return this.svc.findOne(id, t); }

  @Post()
  @Roles('owner')
  @ApiOperation({ summary: 'Create new branch (owner only)' })
  create(@Body() body: Partial<Branch>, @TenantId() t: string) { return this.svc.create({ ...body, tenantId: t }); }

  @Put(':id')
  @Roles('owner', 'manager')
  @ApiOperation({ summary: 'Update branch settings' })
  update(@Param('id') id: string, @Body() body: Partial<Branch>, @TenantId() t: string) {
    return this.svc.update(id, t, body);
  }
}
