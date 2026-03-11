import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetModel1737560000000 implements MigrationInterface {
  name = 'TimesheetModel1737560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "timesheet_status_enum" AS ENUM ('draft', 'pending', 'approved');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS timesheet_code_seq START 1
    `);
    await queryRunner.query(`
      CREATE TABLE "timesheet" (
        "id" SERIAL NOT NULL,
        "code" character varying(10) NOT NULL DEFAULT ('TM' || LPAD(nextval('timesheet_code_seq')::text, 5, '0')),
        "user_id" integer NOT NULL,
        "project_id" integer NOT NULL,
        "status" "timesheet_status_enum" NOT NULL DEFAULT 'draft',
        "week_start_date" DATE NOT NULL,
        "week_end_date" DATE NOT NULL,
        "total_hours" decimal(5,2) NOT NULL DEFAULT 0,
        "comments" character varying(500),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "timesheet_pk" PRIMARY KEY ("id"),
        CONSTRAINT "timesheet_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT,
        CONSTRAINT "timesheet_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT,
        CONSTRAINT "timesheet_week_boundary_check" CHECK (
          EXTRACT(DOW FROM week_start_date) = 1 AND EXTRACT(DOW FROM week_end_date) = 0 AND week_end_date = week_start_date + INTERVAL '6 days'
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "timesheet_code_uc" ON "timesheet" ("code") WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "timesheet_code_uc"`);
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT IF EXISTS "timesheet_week_boundary_check"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "timesheet"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS timesheet_code_seq`);
    await queryRunner.query(`DROP TYPE IF EXISTS "timesheet_status_enum"`);
  }
}
