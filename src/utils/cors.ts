import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function buildCorsOption(configService, logger): CorsOptions {
  const allowOrigins: string[] = configService.get('CORS_ALLOW_ORIGINS').toString().split(',');

  if (logger) {
    logger.log('{buildCorsOption} allowOrigins: ', allowOrigins);
  }

  // https://github.com/expressjs/cors#configuration-options
  return {
    origin: allowOrigins,
    // "origin": 'http://localhost:3000',
    methods: 'OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  };
}
