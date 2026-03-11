import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectEstimateHours1737650400000 implements MigrationInterface {
  name = 'ProjectEstimateHours1737650400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD COLUMN "estimate_hours" character varying(10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      DROP COLUMN "estimate_hours"
    `);
  }
}
