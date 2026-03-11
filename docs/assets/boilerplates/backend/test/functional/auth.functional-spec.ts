
import { JwtService } from '@nestjs/jwt';

import * as request from 'supertest';

import { app, request as req } from './setup-functional';


describe('Auth (functional)', () => {
  describe('/api/v1/auth/signup (POST)', () => {
    const validPayload = {
      email: 'test@example.com',
      password: 'Test123!',
      name: 'Test User',
    };

    it('should create user and return 201 with JWT and user (no password)', async () => {
      const res = await req(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(validPayload)
        .expect(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user.email).toBe(validPayload.email);
      expect(res.body.user.name).toBe(validPayload.name);
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('should reject duplicate email with 409', async () => {
      const dupPayload = {
        email: 'duplicate@example.com',
        password: 'Test123!',
        name: 'Dup User',
      };
      await req(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(dupPayload)
        .expect(201);
      await req(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(dupPayload)
        .expect(409);
    });

    it('should reject weak password with 400', () => {
      return req(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'other@example.com',
          password: 'weak',
          name: 'Other',
        })
        .expect(400);
    });

    it('should reject invalid email with 400', () => {
      return req(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({
          email: 'not-an-email',
          password: 'Test123!',
          name: 'Test',
        })
        .expect(400);
    });
  });

  describe('/api/v1/auth/login (POST)', () => {
    it('should login with valid credentials and return JWT and user without password', async () => {
      const res = await req(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Test123!' })
        .expect(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).not.toHaveProperty('password');
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(typeof res.body.accessToken).toBe('string');
    });

    it('should return 401 with wrong password', () => {
      return req(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should return 401 for non-existent email', () => {
      return req(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!',
        })
        .expect(401);
    });
  });

  describe('/api/v1/auth/profile (GET)', () => {
    it('should return user profile when authenticated', async () => {
      const loginResponse = await req(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Test123!' });

      const authToken = loginResponse.body.accessToken;

      return req(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
        });
    });

    it('should return 401 without authentication', () => {
      return req(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .expect(401);
    });

    it('should return 401 with malformed token', () => {
      return req(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should return 401 with expired token', async () => {
      const jwtService = app.get(JwtService);
      const expiredToken = await jwtService.signAsync(
        { id: 1, email: 'x@y.com', name: 'x', role: 'user' },
        { expiresIn: '-1s' },
      );
      return req(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('RequireRole guard', () => {
    const base = '/api/v1/auth/role-check';
    let jwtService: JwtService;

    beforeAll(() => {
      jwtService = app.get(JwtService);
    });

    const sign = (role: string) =>
      jwtService.signAsync({
        id: role === 'ADMIN' ? 1 : role === 'MANAGER' ? 2 : 3,
        email: `${role.toLowerCase()}@test.com`,
        name: role,
        role,
      });

    it('admin passes all role checks', async () => {
      const token = await sign('ADMIN');
      await req(app.getHttpServer())
        .get(`${base}/admin`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ ok: true, role: 'ADMIN' });
        });
      await req(app.getHttpServer())
        .get(`${base}/manager`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await req(app.getHttpServer())
        .get(`${base}/user`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('manager passes manager checks, fails admin-only', async () => {
      const token = await sign('MANAGER');
      await req(app.getHttpServer())
        .get(`${base}/admin`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await req(app.getHttpServer())
        .get(`${base}/manager`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body.role).toBe('MANAGER'));
      await req(app.getHttpServer())
        .get(`${base}/user`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('user fails admin and manager checks, passes user check', async () => {
      const token = await sign('USER');
      await req(app.getHttpServer())
        .get(`${base}/admin`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await req(app.getHttpServer())
        .get(`${base}/manager`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      await req(app.getHttpServer())
        .get(`${base}/user`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => expect(res.body.role).toBe('USER'));
    });

    it('missing required role returns 403 Forbidden', async () => {
      const token = await sign('USER');
      const res = await req(app.getHttpServer())
        .get(`${base}/admin`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(res.body.statusCode).toBe(403);
    });
  });
});
