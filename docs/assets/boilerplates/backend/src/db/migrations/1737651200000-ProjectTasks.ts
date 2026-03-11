import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTasks1737651200000 implements MigrationInterface {
  name = 'ProjectTasks1737651200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project_tasks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "project_id" integer NOT NULL,
        "name" character varying(400) NOT NULL,
        "assignee_id" integer,
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "project_task_pk" PRIMARY KEY ("id"),
        CONSTRAINT "project_tasks_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
        CONSTRAINT "project_tasks_assignee_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL,
        CONSTRAINT "project_tasks_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "project_tasks_assignee_id_idx" ON "project_tasks" ("assignee_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "project_tasks_assignee_id_idx"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "project_tasks_project_id_idx"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project_tasks"`);
  }
}
