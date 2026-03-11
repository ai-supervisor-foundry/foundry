import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTaskMultiAssigneeBillable1772600000000 implements MigrationInterface {
  name = 'ProjectTaskMultiAssigneeBillable1772600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create join table
    await queryRunner.query(`
      CREATE TABLE "project_task_assignees" (
        "task_id" uuid NOT NULL,
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_task_user" PRIMARY KEY ("task_id", "user_id")
      )
    `);

    // 2. Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "project_task_assignees" 
      ADD CONSTRAINT "FK_project_task_assignees_task" 
      FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "project_task_assignees" 
      ADD CONSTRAINT "FK_project_task_assignees_user" 
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
    `);

    // 3. Backfill data from assignee_id
    await queryRunner.query(`
      INSERT INTO "project_task_assignees" ("task_id", "user_id")
      SELECT "id", "assignee_id" FROM "project_tasks" WHERE "assignee_id" IS NOT NULL
    `);

    // 4. Add is_billable column
    await queryRunner.query(`
      ALTER TABLE "project_tasks" ADD "is_billable" boolean NOT NULL DEFAULT true
    `);

    // 5. Drop old assignee_id column and index
    await queryRunner.query(`
      DROP INDEX IF EXISTS "project_tasks_assignee_id_idx"
    `);
    await queryRunner.query(`
      ALTER TABLE "project_tasks" DROP COLUMN "assignee_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Add assignee_id back
    await queryRunner.query(`
      ALTER TABLE "project_tasks" ADD "assignee_id" integer
    `);

    // 2. Restore data (best effort: take first assignee)
    await queryRunner.query(`
      UPDATE "project_tasks" pt
      SET "assignee_id" = (
        SELECT "user_id" FROM "project_task_assignees" pta 
        WHERE pta."task_id" = pt."id" LIMIT 1
      )
    `);

    // 3. Recreate index
    await queryRunner.query(`
      CREATE INDEX "project_tasks_assignee_id_idx" ON "project_tasks" ("assignee_id")
    `);

    // 4. Drop is_billable
    await queryRunner.query(`
      ALTER TABLE "project_tasks" DROP COLUMN "is_billable"
    `);

    // 5. Drop join table
    await queryRunner.query(`DROP TABLE "project_task_assignees"`);
  }
}
