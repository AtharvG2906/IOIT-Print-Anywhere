/**
 * In-memory sliding-window limiter (per server instance). Good enough to blunt
 * abuse from a single client; use a shared store such as Redis if you run many instances.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Records a hit for `key`. Returns false (without recording) if the limit is reached. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [k, times] of this.hits) {
      if (times.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
  }
}
