import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserEmailLength1001771887200000 implements MigrationInterface {
  name = 'UserEmailLength1001771887200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ALTER COLUMN "email" TYPE character varying(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ALTER COLUMN "email" TYPE character varying
    `);
  }
}
