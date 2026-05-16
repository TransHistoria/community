// Simple retry-with-backoff helper for outbound calls (LLM, email, etc).
//
// shouldRetry decides whether an error or non-OK Response is retryable.
// Default delays are 500ms / 1500ms / 3000ms → ~5s worst case across 3 attempts.

export type RetryOptions = {
  attempts?: number;
  delays?: number[];
  /** Return true to retry. Receives either the thrown error or a non-OK Response. */
  shouldRetry?: (err: unknown) => boolean;
  /** Optional label used for logging. */
  label?: string;
};

const DEFAULT_DELAYS = [500, 1500, 3000];

function isRetryableHttp(err: unknown): boolean {
  if (err instanceof Response) return err.status >= 500 && err.status < 600;
  return true; // network/abort errors are retryable by default
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const delays = options.delays ?? DEFAULT_DELAYS;
  const attempts = options.attempts ?? delays.length + 1; // delays describe waits BETWEEN tries
  const shouldRetry = options.shouldRetry ?? isRetryableHttp;
  const label = options.label ?? "withRetry";

  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const giveUp = i === attempts - 1 || !shouldRetry(err);
      if (giveUp) break;
      const wait = delays[Math.min(i, delays.length - 1)] ?? 1000;
      console.warn(`[${label}] attempt ${i + 1}/${attempts} failed, retrying in ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}
