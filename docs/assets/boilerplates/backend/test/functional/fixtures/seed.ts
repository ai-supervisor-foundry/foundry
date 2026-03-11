import { app, request as req } from '../setup-functional';

export interface SeedResult {
  tokenAdmin?: string;
  tokenUser?: string;
  userId?: number;
}

/** Seed stub store with baseline user. Call after app is initialized. */
export async function seedStub(): Promise<SeedResult> {
  const res = await req(app.getHttpServer())
    .post('/api/v1/auth/signup')
    .send({ email: 'seed@example.com', password: 'Test123!', name: 'Seed User' });
  if (res.status !== 201) throw new Error(`Seed signup failed: ${res.status}`);
  return {
    tokenUser: res.body.accessToken,
    userId: res.body.user?.id,
  };
}
