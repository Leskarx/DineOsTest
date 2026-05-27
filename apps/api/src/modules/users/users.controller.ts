import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId, BranchId, CurrentUser } from '../common/decorators/tenant.decorator';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly svc: UsersService) {}
  @Get() @Roles('manager') findAll(@TenantId() t: string, @BranchId() b: string, @Query('branchId') bid?: string) { return this.svc.findAll(t, bid || b); }
  @Get(':id') findOne(@Param('id') id: string, @TenantId() t: string) { return this.svc.findOne(id, t); }
  @Post() @Roles('manager') create(@Body() body: any, @TenantId() t: string, @BranchId() b: string, @CurrentUser() reqUser: any) {
    if (['owner', 'manager'].includes(body.role) && reqUser.role !== 'owner') {
      throw new ForbiddenException('Only owners can create managers or owners');
    }
    return this.svc.create({ ...body, tenantId: t, branchId: b });
  }
  @Put(':id') @Roles('manager') update(@Param('id') id: string, @Body() body: Partial<User>, @TenantId() t: string, @CurrentUser() reqUser: any) {
    if (body.role && ['owner', 'manager'].includes(body.role) && reqUser.role !== 'owner') {
      throw new ForbiddenException('Only owners can assign manager or owner roles');
    }
    return this.svc.update(id, t, body);
  }
  @Delete(':id') @Roles('owner') remove(@Param('id') id: string, @TenantId() t: string) { return this.svc.deactivate(id, t); }
}
