/* eslint-disable */
import * as SentrySdk from '@sentry/node';
import { CaptureContext, CustomSamplingContext, TransactionContext } from '@sentry/types';
// import * as Tracing from '@sentry/tracing';
// import { Logger } from '@nestjs/common';

enum SentryState {
  virgin,
  initializing,
  initialized,
  skipped, // skip because sentry was disabled
}

const ensureInitialized =
  () =>
  (
    // eslint-disable-next-line @typescript-eslint/ban-types
    target: Object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args) {
      Sentry.ensureInitialized(() => {
        originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };

/**
 * Usage:
 *
 * # Report error
 * Sentry.report(e)
 *
 * # Trace performance
 * Sentry.tracePerformance(() => {
 *   console.log('this fn take too long to complete?');
 * })
 */
export class Sentry {
  private static state = SentryState.virgin;
  private static enable = false;

  /**
   * Lazily init on needed
   * @private
   */
  private static async init(): Promise<boolean> {
    Sentry.enable = process.env.SENTRY_ENABLE === '1';
    if (!Sentry.enable) {
      Sentry.state = SentryState.skipped;
    }

    if (!Sentry.enable) {
      return false;
    }

    Sentry.state = SentryState.initializing;
    SentrySdk.init({
      dsn: 'https://ffdbf06e280b4bd2ab5d6b64fcf19ed5@o567815.ingest.sentry.io/6037686',

      // Set tracesSampleRate to 1.0 to capture 100%
      // of transactions for performance monitoring.
      // We recommend adjusting this value in production
      tracesSampleRate: 1.0,

      debug: process.env.SENTRY_ENVIRONMENT !== 'production',
      // environment: Sentry.env, // use env var instead
    });

    return new Promise((resolve) => {
      setTimeout(() => {
        Sentry.state = SentryState.initialized;
        resolve(true);
      }, 500);
    });
  }

  /**
   * Normally you dont need to call this because all report fn was marked with @ensureInitialized()
   * If you wanna sentry init as soon as possible instead of lazy init
   *
   * @param onDone
   */
  public static safeInit(onDone) {
    Sentry.enable = process.env.SENTRY_ENABLE === '1';
    if (!Sentry.enable) {
      Sentry.state = SentryState.skipped;
    }

    Sentry.ensureInitialized(onDone);
  }

  public static ensureInitialized(fn) {
    if (Sentry.state === SentryState.skipped) {
      return false;
    } else if (Sentry.state === SentryState.initialized) {
      // execute
      fn();
    } else if (Sentry.state === SentryState.initializing) {
      // wait then retry
      setTimeout(() => {
        Sentry.ensureInitialized(fn);
      }, 300);
    } else {
      // init then retry
      Sentry.init().then(() => {
        Sentry.ensureInitialized(fn);
      });
    }
  }

  @ensureInitialized()
  static report(e: any, context?: CaptureContext) {
    SentrySdk.captureException(e, context);
  }

  @ensureInitialized()
  static tracePerformance(
    fn: () => VoidFunction,
    context: TransactionContext,
    customSamplingContext?: CustomSamplingContext,
  ) {
    const transaction = SentrySdk.startTransaction(context);
    try {
      fn();
    } catch (e) {
      SentrySdk.captureException(e, context);
    } finally {
      transaction.finish();
    }
  }

  // static test() {
  //   setTimeout(() => {
  //     try {
  //       //@ts-ignored
  //       foo();
  //     } catch (e) {
  //       Sentry.report(e);
  //     }
  //   }, 99);
  // }
}
