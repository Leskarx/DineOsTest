import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  superadmin: 100,
  owner: 90,
  manager: 70,
  cashier: 50,
  waiter: 40,
  inventory: 35,
  kitchen: 30,
  receptionist: 25,
  housekeeping: 20,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const userRole = user?.role;

    // 1) Explicit match — if the user's role is directly listed, allow
    if (requiredRoles.includes(userRole)) return true;

    // 2) Hierarchy fallback — higher roles (e.g. owner) can access lower-level endpoints
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 999));

    if (userLevel >= minRequired) return true;

    throw new ForbiddenException('Insufficient permissions');
  }
}
