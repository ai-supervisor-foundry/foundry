import { app, request } from './setup-functional';

describe('HealthController (functional)', () => {
  describe('/api/v1/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('/api/v1/health/liveness (GET)', () => {
    it('should return liveness check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/liveness')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
        });
    });
  });
});
