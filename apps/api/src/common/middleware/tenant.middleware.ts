import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { tenantId?: string; branchId?: string }, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const branchId = req.headers['x-branch-id'] as string;

    if (tenantId) req.tenantId = tenantId;
    if (branchId) req.branchId = branchId;

    next();
  }
}
