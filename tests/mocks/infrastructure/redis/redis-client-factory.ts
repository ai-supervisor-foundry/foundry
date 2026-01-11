import { RedisMock } from './redis-mock';

export class RedisClientFactory {
  static createMock(): RedisMock {
    return new RedisMock();
  }

  static createWithData(data: Record<string, string>): RedisMock {
    const mock = new RedisMock();
    for (const [key, value] of Object.entries(data)) {
      mock.set(key, value);
    }
    return mock;
  }

  static createWithLists(lists: Record<string, string[]>): RedisMock {
    const mock = new RedisMock();
    for (const [key, values] of Object.entries(lists)) {
      mock.rpush(key, ...values);
    }
    return mock;
  }
}
