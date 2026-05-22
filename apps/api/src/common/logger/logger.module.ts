import { Module, Global } from '@nestjs/common';
import { WinstonLogger } from './winston.logger';

@Global()
@Module({
  providers: [WinstonLogger],
  exports: [WinstonLogger],
})
export class LoggerModule {}
