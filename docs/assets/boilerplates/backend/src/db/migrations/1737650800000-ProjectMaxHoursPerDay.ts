import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectMaxHoursPerDay1737650800000 implements MigrationInterface {
  name = 'ProjectMaxHoursPerDay1737650800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD COLUMN "max_hours_per_day" integer DEFAULT 8
    `);
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD CONSTRAINT "CHK_project_max_hours_per_day_range"
      CHECK ("max_hours_per_day" IS NULL OR ("max_hours_per_day" >= 1 AND "max_hours_per_day" <= 24))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      DROP CONSTRAINT IF EXISTS "CHK_project_max_hours_per_day_range"
    `);
    await queryRunner.query(`
      ALTER TABLE "project"
      DROP COLUMN "max_hours_per_day"
    `);
  }
}
