/**
 * Sentry instrumentation — MUST be imported at the very top of main.ts,
 * before any NestJS / TypeORM imports.
 */

import * as Sentry from '@sentry/nestjs';
// import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn=process.env.SENTRY_DSN;
const env=process.env.NODE_ENV??'development';

Sentry.init({
  dsn,
  environment:env,

  // integrations:[
  //   nodeProfilingIntegration(),
  // ],

  tracesSampleRate:env==='production'?0.1:1.0,

  // profilesSampleRate:env==='production'?0.1:1.0,

  release:process.env.SENTRY_RELEASE,

  beforeSend(event){
    if(event.request?.data){
      const data=event.request.data as Record<string,unknown>;

      for(const key of [
        'password',
        'newPassword',
        'passwordHash',
        'token',
        'cardNumber',
        'cvv'
      ]){
        if(key in data)data[key]='[REDACTED]';
      }
    }

    return event;
  },
});