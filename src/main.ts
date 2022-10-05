import { NestApplicationOptions, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { getAppLogger } from './utils/logger';
import { buildCorsOption } from './utils/cors';
import { AppErrorsInterceptor } from './utils/errors.interceptor';
import { Sentry } from './utils/sentry.service';
import { ConsoleLoggerOptions } from '@nestjs/common/services/console-logger.service';

async function bootstrap() {
  const logger = getAppLogger();

  const nestAppOpt: NestApplicationOptions = {
    logger: logger,
  };

  const app = await NestFactory.create(AppModule, nestAppOpt);

  const configService = app.get(ConfigService);
  const port = configService.get('APP_PORT');

  app.enableCors(buildCorsOption(configService, logger));

  // handle all app exception
  // const { httpAdapter } = app.get(HttpAdapterHost);
  // app.useGlobalFilters(new AppExceptionsFilter(httpAdapter));
  app.useGlobalInterceptors(new AppErrorsInterceptor());

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(port).then(() => {
    logger.warn(`🚀 Server ready at :${port} :${process.env.NODE_ENV} 🚀`);
    onBootstrapped(app, logger);
  });

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
// For HMR
declare const module: any;

function onBootstrapped(app, logger) {
  // Sentry.test();
  Sentry.safeInit(() => {
    logger.log('Sentry was enabled & initialized');
  });
}

bootstrap();
