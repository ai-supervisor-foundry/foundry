/** In-memory persistent store for functional tests. Survives across requests within a run. */

export interface StubUser {
  id: number;
  email: string;
  name: string;
  password?: string;
  role: string;
  status: string;
  position: string | null;
  audit?: { createdAt: Date; updatedAt: Date; deletedAt: Date | null };
  passwordMatch?(plain: string): boolean;
}

class StubStore {
  users: Map<number, StubUser> = new Map();
  nextUserId = 1;

  reset() {
    this.users.clear();
    this.nextUserId = 1;
  }
}

export const stubStore = new StubStore();
