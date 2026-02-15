export interface TokenEvent {
  readonly tokens: number;
  readonly timestamp: string;
}

export function tokensInWindow(
  events: readonly TokenEvent[],
  windowMinutes: number,
  now: Date,
): number {
  const cutoff = now.getTime() - windowMinutes * 60 * 1000;
  return events.reduce((sum, e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= cutoff ? sum + e.tokens : sum;
  }, 0);
}
