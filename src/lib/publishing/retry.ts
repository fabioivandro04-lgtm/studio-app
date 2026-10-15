export const RETRY_DELAYS_MIN = [1, 5, 15] as const;
export const PROCESSING_TIMEOUT_MIN = 30;

/** Quando tentar de novo após a falha n.º `attemptsAfterFailure`; `null` → desistir (failed). */
export function nextRetryAt(attemptsAfterFailure: number, now: Date): Date | null {
  const delay = RETRY_DELAYS_MIN[attemptsAfterFailure - 1];
  if (delay === undefined) return null;
  return new Date(now.getTime() + delay * 60_000);
}
