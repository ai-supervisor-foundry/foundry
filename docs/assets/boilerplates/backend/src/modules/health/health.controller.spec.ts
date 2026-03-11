import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn((indicators) =>
              Promise.all(indicators.map((fn: () => any) => fn())).then(() => ({
                status: 'ok',
                info: {},
                error: {},
                details: {},
              })),
            ),
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should return status ok from simpleCheck', async () => {
    const result = await controller.simpleCheck();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('should return health check result from check', async () => {
    const result = await controller.check();
    expect(result.status).toBe('ok');
  });
});
