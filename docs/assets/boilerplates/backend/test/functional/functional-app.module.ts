import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { HealthModule } from '../../src/modules/health/health.module';

/** App module for functional tests with stub DB. Replaces UsersModule with StubUsersModule. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    HealthModule,
  ],
})
export class FunctionalAppModule {}
