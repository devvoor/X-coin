import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, delayMs, backoffMultiplier = 2, onRetry } = options;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        logger.warn(
          { error: lastError.message, attempt: attempt + 1, maxRetries, delay },
          'Retry attempt failed, retrying...'
        );

        if (onRetry) {
          onRetry(lastError, attempt + 1);
        }

        await sleep(delay);
      }
    }
  }

  logger.error({ error: lastError!.message, maxRetries }, 'All retry attempts failed');
  throw lastError!;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
