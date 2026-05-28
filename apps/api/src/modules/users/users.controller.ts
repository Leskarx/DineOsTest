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
  @Get() @Roles('owner', 'manager', 'restaurant_manager', 'hotel_manager') findAll(@TenantId() t: string, @BranchId() b: string) { return this.svc.findAll(t, b); }
  @Get(':id') findOne(@Param('id') id: string, @TenantId() t: string) { return this.svc.findOne(id, t); }
  @Post() @Roles('owner', 'manager', 'restaurant_manager', 'hotel_manager') create(@Body() body: any, @TenantId() t: string, @BranchId() b: string, @CurrentUser() reqUser: any) {
    this.validateRoleHierarchy(reqUser.role, body.role);
    const finalBranchId = (reqUser.role === 'owner' && body.branchId) ? body.branchId : b;
    return this.svc.create({ ...body, tenantId: t, branchId: finalBranchId });
  }

  @Put(':id') @Roles('owner', 'manager', 'restaurant_manager', 'hotel_manager') update(@Param('id') id: string, @Body() body: Partial<User>, @TenantId() t: string, @CurrentUser() reqUser: any) {
    if (body.role) {
      this.validateRoleHierarchy(reqUser.role, body.role);
    }
    if (body.branchId && reqUser.role !== 'owner') {
      delete body.branchId;
    }
    return this.svc.update(id, t, body);
  }

  private validateRoleHierarchy(actorRole: string, targetRole: string) {
    if (['owner', 'manager'].includes(targetRole) && actorRole !== 'owner') {
      throw new ForbiddenException('Only owners can create Branch Managers or Owners');
    }
    if (['restaurant_manager', 'hotel_manager'].includes(targetRole) && !['owner', 'manager'].includes(actorRole)) {
      throw new ForbiddenException('Only Owners and Branch Managers can create Department Managers');
    }
    if (actorRole === 'restaurant_manager' && !['cashier', 'waiter', 'kitchen', 'inventory'].includes(targetRole)) {
       throw new ForbiddenException('Restaurant Managers can only create restaurant staff');
    }
    if (actorRole === 'hotel_manager' && !['receptionist', 'housekeeping'].includes(targetRole)) {
       throw new ForbiddenException('Hotel Managers can only create hotel staff');
    }
  }
  @Delete(':id') @Roles('owner') remove(@Param('id') id: string, @TenantId() t: string) { return this.svc.deactivate(id, t); }
}
