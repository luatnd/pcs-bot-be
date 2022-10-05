export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sleep = delay;

/**
 * Retry until canStop return true
 * Or until max retry was exceeded
 */
export async function retryUntil(canStop: () => boolean, maxRetry = 10, retryIntervalMs = 1000) {
  let retry = 0;
  const MAX_RETRY = 10;
  while (retry < MAX_RETRY) {
    retry++;

    if (canStop()) {
      retry = MAX_RETRY;
    } else {
      await sleep(retryIntervalMs);
    }
  }
}
