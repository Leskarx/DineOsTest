import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { WinstonLogger } from '../logger/winston.logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new WinstonLogger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, url, ip } = req;
    const requestId = uuidv4().slice(0, 8);
    req.requestId = requestId;

    const tenantId = req.headers['x-tenant-id'];
    const userId = req.user?.sub;
    const start = Date.now();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      })),
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.logRequest({
            method,
            url,
            statusCode: res.statusCode,
            duration: Date.now() - start,
            tenantId,
            userId,
            ip,
          });
        },
        error: (err) => {
          const res = context.switchToHttp().getResponse();
          this.logger.logRequest({
            method,
            url,
            statusCode: res.statusCode || 500,
            duration: Date.now() - start,
            tenantId,
            userId,
            ip,
          });
        },
      }),
    );
  }
}
