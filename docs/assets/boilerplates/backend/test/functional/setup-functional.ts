import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as request from 'supertest';
import { FunctionalAppModule } from './functional-app.module';
import { UsersModule } from '../../src/modules/users/users.module';
import { StubUsersModule } from './stub-db/stub-users.module';
import { AppModule } from '../../src/app.module';
import { testDataSourceOptions } from '../../src/db/test.config';

const useRealDb = process.env.USE_REAL_DB === '1';

let app: INestApplication;
let moduleFixture: TestingModule;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const baseModule = useRealDb
    ? Test.createTestingModule({
        imports: [TypeOrmModule.forRoot(testDataSourceOptions), AppModule],
      })
    : Test.createTestingModule({
        imports: [FunctionalAppModule],
      }).overrideModule(UsersModule).useModule(StubUsersModule);

  moduleFixture = await baseModule.compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();

  if (useRealDb) {
    const { DataSource } = await import('typeorm');
    const dataSource = app.get(DataSource);
    await dataSource.query('TRUNCATE "user" RESTART IDENTITY CASCADE;');
  }
});

afterAll(async () => {
  await app.close();
  await moduleFixture.close();
});

export { app, request, useRealDb };
