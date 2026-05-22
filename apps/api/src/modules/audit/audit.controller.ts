import {
  Controller, DefaultValuePipe, Get, Param,
  ParseIntPipe, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'audit', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('tenant')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get audit logs for this tenant with optional filters' })
  @ApiQuery({ name: 'page',   required: false })
  @ApiQuery({ name: 'limit',  required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'from',   required: false, description: 'ISO date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to',     required: false, description: 'ISO date (YYYY-MM-DD)' })
  getTenantLogs(
    @TenantId() tenantId: string,
    @Query('page',  new DefaultValuePipe(1),   ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from')   from?: string,
    @Query('to')     to?: string,
  ) {
    return this.auditService.findByTenant(tenantId, {
      page, limit, entity, action, userId, from, to,
    });
  }

  @Get('entity/:entity/:id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get audit trail for a specific entity record' })
  getEntityLogs(
    @TenantId() tenantId: string,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.auditService.findByEntity(entity, id, tenantId);
  }

  @Get('user/:userId')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  getUserLogs(
    @TenantId() tenantId: string,
    @Param('userId') userId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.auditService.findByUser(userId, tenantId, limit);
  }
}
