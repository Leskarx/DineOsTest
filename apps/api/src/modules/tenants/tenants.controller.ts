import { Controller, Get, Put, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody, ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { TenantsService } from './tenants.service';
import { Tenant } from './entities/tenant.entity';

class RazorpayKeysDto {
  @ApiProperty({ example: 'rzp_live_xxxxxxxxxxxxxxxx' })
  @IsString() @MinLength(10) keyId: string;

  @ApiProperty({ example: 'your_key_secret' })
  @IsString() @MinLength(10) keySecret: string;
}

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'tenant', version: '1' })
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  // Any authenticated user may read tenant info (needed for branding on receipts)
  @Get()
  @Roles('waiter', 'cashier', 'kitchen', 'inventory', 'manager', 'owner')
  @ApiOperation({ summary: 'Get current tenant profile' })
  getMe(@TenantId() id: string) { return this.svc.findById(id); }

  // Only owners may change business settings
  @Put()
  @Roles('owner')
  @ApiOperation({ summary: 'Update tenant profile (owner only)' })
  update(@TenantId() id: string, @Body() body: Partial<Tenant>) { return this.svc.update(id, body); }

  // ── Razorpay integration ───────────────────────────────────────────────────

  @Get('razorpay')
  @Roles('owner', 'manager')
  @ApiOperation({ summary: 'Get Razorpay connection status (secret is never returned)' })
  getRazorpay(@TenantId() id: string) { return this.svc.getRazorpayStatus(id); }

  @Post('razorpay')
  @Roles('owner')
  @ApiBody({ type: RazorpayKeysDto })
  @ApiOperation({ summary: 'Save & verify Razorpay keys — activates payment integration' })
  saveRazorpay(@TenantId() id: string, @Body() body: RazorpayKeysDto) {
    return this.svc.saveRazorpayKeys(id, body.keyId, body.keySecret);
  }

  @Delete('razorpay')
  @Roles('owner')
  @ApiOperation({ summary: 'Disconnect Razorpay — removes stored credentials' })
  disconnectRazorpay(@TenantId() id: string) { return this.svc.disconnectRazorpay(id); }
}
