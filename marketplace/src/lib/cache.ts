interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class Cache<T> {
  private store = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttlMs: number = 5 * 60 * 1000) {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  delete(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

export const sessionCache = new Cache<any>();
export const userCache = new Cache<any>();
export const dealCache = new Cache<any>();

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const cleanup = (map: Map<string, CacheEntry<any>>) => {
    for (const [key, entry] of map.entries()) {
      if (now > entry.expiresAt) {
        map.delete(key);
      }
    }
  };
  cleanup(sessionCache['store']);
  cleanup(userCache['store']);
  cleanup(dealCache['store']);
}, 10 * 60 * 1000);
