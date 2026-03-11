import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectCodeLength161737650000000 implements MigrationInterface {
  name = 'ProjectCodeLength161737650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      ALTER COLUMN "code" TYPE character varying(16)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      ALTER COLUMN "code" TYPE character varying(10)
    `);
  }
}
