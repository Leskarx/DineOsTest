import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BackupService } from './backup.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
@Controller({ path: 'admin/backup', version: '1' })
export class BackupController {
  constructor(private readonly svc: BackupService) {}

  @Post('run')
  @ApiOperation({ summary: 'Trigger a manual database backup immediately' })
  async runNow() {
    const result = await this.svc.runBackup();
    return result;
  }

  @Get('list')
  @ApiOperation({ summary: 'List recent local backup files' })
  list() {
    return { data: this.svc.listLocalBackups() };
  }
}
