import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetTaskId1737651400000 implements MigrationInterface {
  name = 'TimesheetTaskId1737651400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ADD COLUMN "task_id" uuid NULL,
      ADD CONSTRAINT "timesheet_task_id_fk"
        FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE RESTRICT
    `);

    const projectsWithTimesheets = await queryRunner.query(
      `SELECT DISTINCT t.project_id, p.created_by
       FROM timesheet t
       JOIN project p ON p.id = t.project_id`,
    );
    for (const row of projectsWithTimesheets) {
      const taskId = await queryRunner.query(
        `INSERT INTO project_tasks (id, project_id, name, created_by)
         VALUES (gen_random_uuid(), $1, 'General', $2)
         RETURNING id`,
        [row.project_id, row.created_by],
      );
      await queryRunner.query(
        `UPDATE timesheet SET task_id = $1 WHERE project_id = $2`,
        [taskId[0].id, row.project_id],
      );
    }

    await queryRunner.query(`
      ALTER TABLE "timesheet" ALTER COLUMN "task_id" SET NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "timesheet_user_project_task_week_uc"
      ON "timesheet" ("user_id", "project_id", "task_id", "week_start_date")
      WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "timesheet_user_project_task_week_uc"`,
    );
    await queryRunner.query(`
      ALTER TABLE "timesheet" DROP CONSTRAINT IF EXISTS "timesheet_task_id_fk"
    `);
    await queryRunner.query(`
      ALTER TABLE "timesheet" DROP COLUMN IF EXISTS "task_id"
    `);
  }
}
