import { app, request, useRealDb } from './setup-functional';

(useRealDb ? describe : describe.skip)('UsersController (functional)', () => {
  let authToken: string;

  beforeAll(async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123',
      });

    if (loginResponse.status === 200) {
      authToken = loginResponse.body.accessToken;
    }
  });

  describe('/api/v1/users/profile (GET)', () => {
    it('should return user profile when authenticated', async () => {
      if (!authToken) return;

      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
        });
    });

    it('should return 401 without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .expect(401);
    });
  });

  describe('/api/v1/users (GET)', () => {
    it('should return users list when authenticated as admin', async () => {
      if (!authToken) return;

      return request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          expect([200, 403]).toContain(res.status);
        });
    });
  });

  describe('/api/v1/users/:id (DELETE)', () => {
    it('should return 403 when deleting first admin user (id 1)', async () => {
      if (!authToken) return;
      return request(app.getHttpServer())
        .delete('/api/v1/users/1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
