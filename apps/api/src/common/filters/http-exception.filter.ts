import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message || exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception));

      // Report unhandled server errors to Sentry (4xx are user errors — not sent)
      Sentry.withScope((scope) => {
        scope.setTag('url', req.url);
        scope.setTag('method', req.method);
        scope.setExtra('body', req.body);
        scope.setExtra('query', req.query);
        // Attach tenant context if available (set by JWT strategy)
        const user = (req as any).user;
        if (user) {
          scope.setUser({ id: user.sub ?? user.id, email: user.email });
          scope.setTag('tenantId', user.tenantId);
        }
        Sentry.captureException(exception);
      });
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
