import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEmailNullableBackfill1771887300000 implements MigrationInterface {
  name = 'UserEmailNullableBackfill1771887300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user"
      SET email = 'ahmed.haider@emaxsole.com'
      WHERE email IS NULL OR trim(email) = ''
    `);
  }

  public async down(_: QueryRunner): Promise<void> {
    /* backfill not reversible */
  }
}
