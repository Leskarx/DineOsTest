import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

/**
 * AuditInterceptor — attach to controllers or routes you want to audit.
 * Logs POST (CREATE), PATCH/PUT (UPDATE), DELETE actions automatically.
 *
 * Usage:
 *   @UseInterceptors(AuditInterceptor)
 *   @Controller(...)
 *
 * Or on specific routes:
 *   @UseInterceptors(AuditInterceptor)
 *   @Delete(':id')
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, ip, headers } = req;

    // Only audit mutating operations
    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    const action = actionMap[method];
    if (!action) return next.handle();

    // Derive entity name from URL path: /api/v1/orders/123 → orders
    const segments = url.replace(/\?.*$/, '').split('/').filter(Boolean);
    // segments might be: ['api', 'v1', 'orders', 'uuid'] or ['api', 'v1', 'orders']
    const versionIndex = segments.findIndex((s: string) => s.match(/^v\d+$/));
    const entity = versionIndex >= 0 ? segments[versionIndex + 1] : segments[2] || 'unknown';
    const entityId = segments[segments.length - 1]?.match(/^[0-9a-f-]{36}$/) ? segments[segments.length - 1] : undefined;

    const user = req.user;
    const tenantId = headers['x-tenant-id'] || user?.tenantId;
    const branchId = user?.branchId;
    const userId = user?.sub;
    const userAgent = headers['user-agent'];

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const newValue = responseData?.data || responseData;
          // Truncate large objects to avoid bloating audit log
          const sanitized = this.truncate(newValue);
          this.auditService.log({
            tenantId,
            branchId,
            userId,
            action,
            entity,
            entityId: entityId || sanitized?.id,
            newValue: action === 'DELETE' ? null : sanitized,
            ipAddress: ip,
            userAgent,
            metadata: { method, url },
          }).catch(() => {});
        },
        error: () => {
          // Don't log failed mutations — only successful ones
        },
      }),
    );
  }

  private truncate(obj: any, maxKeys = 30): any {
    if (!obj || typeof obj !== 'object') return obj;
    const keys = Object.keys(obj);
    if (keys.length <= maxKeys) return obj;
    const truncated: any = {};
    for (const key of keys.slice(0, maxKeys)) truncated[key] = obj[key];
    truncated['_truncated'] = true;
    return truncated;
  }
}
