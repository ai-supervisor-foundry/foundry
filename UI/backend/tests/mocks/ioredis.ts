// In-memory Redis mock for UI backend tests
// Supports string ops (get/set/del), list ops (lpush/rpush/lpop/rpop/lrange/llen/lset/lrem), hash ops (hset/hget/hgetall/hdel)

class RedisMock {
  private data: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private hashes: Map<string, Map<string, string>> = new Map();

  // Connection
  async quit(): Promise<string> { return 'OK'; }

  on(_event: string, _handler: (...args: any[]) => void): this {
    // Fire 'connect' immediately for setup
    if (_event === 'connect') {
      setTimeout(() => _handler(), 0);
    }
    return this;
  }

  // String operations
  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<string> {
    this.data.set(key, value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const had = this.data.has(key) || this.lists.has(key) || this.hashes.has(key);
    this.data.delete(key);
    this.lists.delete(key);
    this.hashes.delete(key);
    return had ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return (this.data.has(key) || this.lists.has(key) || this.hashes.has(key)) ? 1 : 0;
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    list.unshift(...values);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    list.push(...values);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.shift() || null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    if (!list || list.length === 0) return null;
    return list.pop() || null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) return [];
    const len = list.length;
    let s = start < 0 ? len + start : start;
    let e = stop < 0 ? len + stop : stop;
    s = Math.max(0, s);
    return list.slice(s, e + 1);
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length ?? 0;
  }

  async lset(key: string, index: number, value: string): Promise<string> {
    const list = this.lists.get(key);
    if (!list || index < 0 || index >= list.length) {
      throw new Error('ERR index out of range');
    }
    list[index] = value;
    return 'OK';
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.lists.get(key);
    if (!list) return 0;
    let removed = 0;
    const absCount = Math.abs(count) || list.length;
    for (let i = 0; i < list.length && removed < absCount; i++) {
      if (list[i] === value) {
        list.splice(i, 1);
        removed++;
        i--;
      }
    }
    return removed;
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const hash = this.hashes.get(key)!;
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of hash) {
      result[k] = v;
    }
    return result;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    for (const f of fields) {
      if (hash.delete(f)) count++;
    }
    return count;
  }

  // Test helpers
  reset(): void {
    this.data.clear();
    this.lists.clear();
    this.hashes.clear();
  }
}

// Singleton instance shared across all services
const instance = new RedisMock();

// Default export mimics `new Redis(options)` constructor
export default class MockRedis {
  constructor(_options?: any) {
    return instance as any;
  }

  // Static access for tests
  static getInstance(): RedisMock {
    return instance;
  }

  static reset(): void {
    instance.reset();
  }
}

export { RedisMock };
