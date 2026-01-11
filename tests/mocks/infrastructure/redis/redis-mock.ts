
export class RedisMock {
  private data: Map<string, string> = new Map();
  private lists: Map<string, string[]> = new Map();
  private dbIndex: number = 0;
  private callHistory: { method: string; args: any[] }[] = [];

  constructor() {
    this.reset();
  }

  // --- Connection Methods ---
  async select(index: number): Promise<string> {
    this.dbIndex = index;
    this.recordCall('select', [index]);
    return 'OK';
  }

  async quit(): Promise<string> {
    this.recordCall('quit', []);
    return 'OK';
  }

  // --- String Operations ---
  async get(key: string): Promise<string | null> {
    this.recordCall('get', [key]);
    return this.data.get(this.getKey(key)) || null;
  }

  async set(key: string, value: string): Promise<string> {
    this.recordCall('set', [key, value]);
    this.data.set(this.getKey(key), value);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    this.recordCall('del', [key]);
    const k = this.getKey(key);
    if (this.data.has(k)) {
      this.data.delete(k);
      return 1;
    }
    if (this.lists.has(k)) {
      this.lists.delete(k);
      return 1;
    }
    return 0;
  }

  async exists(key: string): Promise<number> {
    this.recordCall('exists', [key]);
    const k = this.getKey(key);
    return (this.data.has(k) || this.lists.has(k)) ? 1 : 0;
  }

  // --- List Operations ---
  async lpush(key: string, ...values: string[]): Promise<number> {
    this.recordCall('lpush', [key, ...values]);
    const k = this.getKey(key);
    if (!this.lists.has(k)) {
      this.lists.set(k, []);
    }
    const list = this.lists.get(k)!;
    list.unshift(...values); // Push to front
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    this.recordCall('rpush', [key, ...values]);
    const k = this.getKey(key);
    if (!this.lists.has(k)) {
      this.lists.set(k, []);
    }
    const list = this.lists.get(k)!;
    list.push(...values); // Push to end
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    this.recordCall('lpop', [key]);
    const k = this.getKey(key);
    const list = this.lists.get(k);
    if (!list || list.length === 0) return null;
    return list.shift() || null;
  }

  async rpop(key: string): Promise<string | null> {
    this.recordCall('rpop', [key]);
    const k = this.getKey(key);
    const list = this.lists.get(k);
    if (!list || list.length === 0) return null;
    return list.pop() || null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    this.recordCall('lrange', [key, start, stop]);
    const k = this.getKey(key);
    const list = this.lists.get(k);
    if (!list) return [];
    
    // Redis lrange handles negative indices and inclusive stop
    const len = list.length;
    let s = start < 0 ? len + start : start;
    let e = stop < 0 ? len + stop : stop;

    // Clamp
    s = Math.max(0, s);
    // Redis lrange is inclusive for 'stop', slice is exclusive
    return list.slice(s, e + 1); 
  }

  async llen(key: string): Promise<number> {
    this.recordCall('llen', [key]);
    const k = this.getKey(key);
    const list = this.lists.get(k);
    return list ? list.length : 0;
  }

  // --- Helper Methods (Non-Redis) ---
  reset(): void {
    this.data.clear();
    this.lists.clear();
    this.callHistory = [];
    this.dbIndex = 0;
  }

  getCallHistory(): { method: string; args: any[] }[] {
    return [...this.callHistory];
  }

  private getKey(key: string): string {
    return `${this.dbIndex}:${key}`;
  }

  private recordCall(method: string, args: any[]) {
    this.callHistory.push({ method, args });
  }
}
