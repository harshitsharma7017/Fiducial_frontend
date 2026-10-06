/**
 * Simulated network latency for the sample data layer, so loading states are visible. Tests
 * resolve at once, without a timer.
 */
export function delay(ms: number): Promise<void> {
  if (process.env.NODE_ENV === 'test') return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
