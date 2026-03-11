import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectModel1737550000000 implements MigrationInterface {
  name = 'ProjectModel1737550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "project_status_enum" AS ENUM ('active', 'completed', 'archived');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE "project" (
        "id" SERIAL NOT NULL,
        "code" character varying(10) NOT NULL,
        "description" character varying(40),
        "default_task" character varying(100),
        "start_date" DATE,
        "end_date" DATE,
        "status" "project_status_enum" NOT NULL DEFAULT 'active',
        "created_by" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "project_pk" PRIMARY KEY ("id"),
        CONSTRAINT "project_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "project_code_uc" ON "project" ("code") WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "project" ADD CONSTRAINT "project_dates_check" CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT IF EXISTS "project_dates_check"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "project"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "project_status_enum"`);
  }
}
