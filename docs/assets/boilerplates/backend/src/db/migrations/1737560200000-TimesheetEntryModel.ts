import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetEntryModel1737560200000 implements MigrationInterface {
  name = 'TimesheetEntryModel1737560200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "timesheet_entry" (
        "id" SERIAL NOT NULL,
        "timesheet_id" integer NOT NULL,
        "project_task" character varying(255) NOT NULL,
        "date" DATE NOT NULL,
        "hours" decimal(4,2) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "timesheet_entry_pk" PRIMARY KEY ("id"),
        CONSTRAINT "timesheet_entry_timesheet_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE RESTRICT,
        CONSTRAINT "timesheet_entry_hours_check" CHECK (hours >= 0 AND hours <= 8)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT IF EXISTS "timesheet_entry_hours_check"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "timesheet_entry"`);
  }
}
