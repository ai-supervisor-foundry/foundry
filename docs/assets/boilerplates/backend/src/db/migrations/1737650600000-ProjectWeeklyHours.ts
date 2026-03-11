import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectWeeklyHours1737650600000 implements MigrationInterface {
  name = 'ProjectWeeklyHours1737650600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD COLUMN "project_weekly_hours" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD CONSTRAINT "CHK_project_weekly_hours_range"
      CHECK ("project_weekly_hours" IS NULL OR ("project_weekly_hours" >= 0 AND "project_weekly_hours" <= 999))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project"
      DROP CONSTRAINT IF EXISTS "CHK_project_weekly_hours_range"
    `);
    await queryRunner.query(`
      ALTER TABLE "project"
      DROP COLUMN "project_weekly_hours"
    `);
  }
}
