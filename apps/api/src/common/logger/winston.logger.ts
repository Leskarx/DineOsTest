import { LoggerService, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import * as path from 'path';

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, context, stack, ...meta }) => {
    const ctx = context ? ` [${context}]` : '';
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts}${ctx} ${level}: ${stack || message}${extra}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json(),
);

@Injectable()
export class WinstonLogger implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly isProduction: boolean;

  constructor(config?: ConfigService) {
    this.isProduction = (config?.get('NODE_ENV') || process.env.NODE_ENV) === 'production';

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: this.isProduction ? prodFormat : devFormat,
      }),
    ];

    // File transports in production
    if (this.isProduction) {
      transports.push(
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error',
          format: prodFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log'),
          format: prodFormat,
          maxsize: 20 * 1024 * 1024,
          maxFiles: 10,
        }),
      );
    }

    this.logger = winston.createLogger({
      level: this.isProduction ? 'info' : 'debug',
      transports,
      exitOnError: false,
    });
  }

  log(message: any, context?: string) {
    this.logger.info(this.formatMessage(message), { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(this.formatMessage(message), { context, stack: trace });
  }

  warn(message: any, context?: string) {
    this.logger.warn(this.formatMessage(message), { context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(this.formatMessage(message), { context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(this.formatMessage(message), { context });
  }

  // Structured log with extra metadata
  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, meta);
  }

  // Log an HTTP request (called from interceptor)
  logRequest(opts: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    tenantId?: string;
    userId?: string;
    ip?: string;
  }) {
    this.logger.info('HTTP Request', {
      type: 'http',
      ...opts,
    });
  }

  // Log an audit event
  logAudit(opts: {
    action: string;
    entity: string;
    entityId?: string;
    userId?: string;
    tenantId?: string;
    oldValue?: any;
    newValue?: any;
  }) {
    this.logger.info('Audit Event', {
      type: 'audit',
      ...opts,
    });
  }

  private formatMessage(message: any): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.message;
    return JSON.stringify(message);
  }
}

// Singleton for use outside NestJS DI (e.g. main.ts bootstrap)
export const bootstrapLogger = new WinstonLogger();
