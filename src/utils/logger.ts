/* eslint-disable */
import { ConsoleLogger } from '@nestjs/common';
import { ConsoleLoggerOptions } from '@nestjs/common/services/console-logger.service';
import { getLog } from 'nestjs-log';

/*
log.verbose(`msg`)
log.debug(`msg`)
log.info(`msg`)
log.warn(`msg`)
log.error(`msg`)
 */

/*
Retain the nestjs logger, but inject file logger
 */
export class AppLogger extends ConsoleLogger {
  fileLogger: any;

  // constructor();
  // constructor(context: string);
  constructor(context: string = undefined, options: ConsoleLoggerOptions = undefined) {
    super(context, options);
    // this.setLogLevels(['error']);
    this.fileLogger = getLog(context ?? 'app');
  }

  // setContext(context: string) {
  //   super.setContext(context);
  //   // regenerate file logger
  //   this.fileLogger = getLog(context ?? 'app');
  // }

  log(message: any, context?: string) {
    super.log.apply(this, arguments);

    this.fileLogger.info.apply(this.fileLogger, arguments);
  }

  error(message: any, stack?: string, context?: string) {
    super.error.apply(this, arguments);

    this.fileLogger.error.apply(this.fileLogger, arguments);
  }

  warn(message: any, context?: string) {
    super.warn.apply(this, arguments);

    this.fileLogger.warn.apply(this.fileLogger, arguments);
  }

  debug(message: any, context?: string) {
    super.debug.apply(this, arguments);

    this.fileLogger.debug.apply(this.fileLogger, arguments);
  }

  verbose(message: any, context?: string) {
    super.verbose.apply(this, arguments);

    this.fileLogger.verbose.apply(this.fileLogger, arguments);
  }
}

export function getAppLogger(): AppLogger {
  const logLevelsEnv = process.env.LOG_LEVELS_CONSOLE;
  const loggerOpt: ConsoleLoggerOptions = {};
  if (logLevelsEnv) {
    const levels = JSON.parse(logLevelsEnv);
    if (Array.isArray(levels)) {
      loggerOpt.logLevels = levels;
    } else {
      throw new Error('process.env.LOG_LEVELS must be an valid JSON array');
    }
  }
  const logger = new AppLogger('app', loggerOpt);

  return logger;
}
