import { Module, forwardRef } from '@nestjs/common';
import { StubUsersService } from './stub-users.service';
import { UsersService } from '../../../src/modules/users/users.service';
import { AuthModule } from '../../../src/modules/auth/auth.module';

/** Replaces UsersModule for functional tests. No TypeORM. */
@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [{ provide: UsersService, useClass: StubUsersService }],
  exports: [UsersService],
})
export class StubUsersModule {}
