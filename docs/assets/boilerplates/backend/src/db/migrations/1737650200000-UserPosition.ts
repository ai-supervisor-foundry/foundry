import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPosition1737650200000 implements MigrationInterface {
  name = 'UserPosition1737650200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "position" character varying(200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN "position"
    `);
  }
}
