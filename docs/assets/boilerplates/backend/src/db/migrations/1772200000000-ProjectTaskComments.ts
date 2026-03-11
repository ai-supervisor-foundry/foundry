import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTaskComments1772200000000 implements MigrationInterface {
  name = 'ProjectTaskComments1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_tasks"
      ADD COLUMN IF NOT EXISTS "comments" character varying(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "project_tasks"
      DROP COLUMN IF EXISTS "comments"
    `);
  }
}
