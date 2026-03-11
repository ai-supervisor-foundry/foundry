import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTaskSortIndex1772100000000 implements MigrationInterface {
  name = 'ProjectTaskSortIndex1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD COLUMN "sort_index" integer NOT NULL DEFAULT 0`,
    );
    // Backfill existing tasks: assign sort_index by created_at order per project
    await queryRunner.query(`
      UPDATE "project_tasks" AS pt
      SET sort_index = sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at ASC) AS rn
        FROM "project_tasks"
      ) sub
      WHERE pt.id = sub.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP COLUMN "sort_index"`,
    );
  }
}
