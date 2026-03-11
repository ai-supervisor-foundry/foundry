import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetEntryTaskType1737651000000 implements MigrationInterface {
  name = 'TimesheetEntryTaskType1737651000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet_entry"
      ADD COLUMN "task_type" character varying(20) NOT NULL DEFAULT 'billable'
    `);
    await queryRunner.query(`
      ALTER TABLE "timesheet_entry"
      ADD CONSTRAINT "CHK_timesheet_entry_task_type"
      CHECK ("task_type" IN ('billable', 'nonbillable'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet_entry"
      DROP CONSTRAINT IF EXISTS "CHK_timesheet_entry_task_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "timesheet_entry"
      DROP COLUMN "task_type"
    `);
  }
}
