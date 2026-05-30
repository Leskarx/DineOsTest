import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../../users/entities/user.entity';
import { Branch } from '../../branches/entities/branch.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Subscription, SubscriptionStatus } from '../../subscriptions/entities/subscription.entity';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  branchId?: string | null;
  role: string;
  permissions?: Record<string, any>;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', 'secret'),
      // Pass the raw request so we can validate the x-tenant-id header
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    // ── Tenant-ID header spoofing prevention ─────────────────────────────────
    // If the client sends an x-tenant-id header it MUST match what is embedded
    // in the signed JWT. This prevents a compromised client from reading another
    // tenant's data by swapping the header value.
    const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
    if (headerTenantId && headerTenantId !== payload.tenantId) {
      throw new UnauthorizedException('x-tenant-id header does not match token');
    }

    // Superadmin tokens have tenantId = 'superadmin' — skip DB user lookup
    if (payload.role === 'superadmin') {
      return { ...payload, id: payload.sub };
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub, tenantId: payload.tenantId, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');

    // ── Tenant suspension check ───────────────────────────────────────────────
    // Return 402 Payment Required when the tenant account has been suspended so
    // the frontend can redirect to the billing page rather than showing a generic
    // 403/401 error.
    const tenant = await this.tenantRepo.findOne({
      where: { id: payload.tenantId },
      select: ['id', 'isActive'],
    });
    if (!tenant?.isActive) {
      throw new HttpException('Tenant account suspended', HttpStatus.PAYMENT_REQUIRED);
    }

    // ── Subscription status check ─────────────────────────────────────────────
    // Return 402 when the subscription has been cancelled so ALL protected routes
    // reject cleanly (not just the ones guarded by @Features()).
    const sub = await this.subRepo.findOne({
      where: { tenantId: payload.tenantId },
      select: ['id', 'status'],
      order: { createdAt: 'DESC' },
    });
    if (sub?.status === SubscriptionStatus.CANCELLED) {
      throw new HttpException('Subscription cancelled', HttpStatus.PAYMENT_REQUIRED);
    }

    // ── Branch-ID header spoofing prevention ─────────────────────────────────
    // A multi-branch user can legitimately send x-branch-id to scope their
    // session to a specific branch. Validate that the requested branch actually
    // belongs to the same tenant so a user from tenant A cannot switch into a
    // branch owned by tenant B by crafting the header.
    const headerBranchId = req.headers['x-branch-id'] as string | undefined;
    if (headerBranchId && headerBranchId !== payload.branchId) {
      const branch = await this.branchRepo.findOne({
        where: { id: headerBranchId, tenantId: payload.tenantId, isActive: true },
        select: ['id'],
      });
      if (!branch) {
        throw new UnauthorizedException('x-branch-id does not belong to your tenant');
      }
      // Propagate the validated branch override so downstream decorators
      // (@BranchId()) and service calls use the correct branch scope.
      return { ...payload, id: payload.sub, branchId: headerBranchId, permissions: user.permissions ?? {} };
    }

    return { ...payload, id: payload.sub, permissions: user.permissions ?? {} };
  }
}
