export const ttl = {
  minutes: (value: number) => value * 60 * 1000,
  hours: (value: number) => value * 60 * 60 * 1000
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export class TtlCache {
  private entries = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.entries.set(key, {
      expiresAt: Date.now() + ttlMs,
      value
    });
  }

  async remember<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const value = await loader();
    this.set(key, value, ttlMs);
    return value;
  }
}

export const cache = new TtlCache();
