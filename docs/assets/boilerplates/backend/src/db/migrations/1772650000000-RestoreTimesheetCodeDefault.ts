import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restore default for timesheet.code (TM00001, TM00002, ...).
 * UserManagerId (and prior migrations) had dropped it; existing DBs need it restored.
 */
export class RestoreTimesheetCodeDefault1772650000000 implements MigrationInterface {
  name = 'RestoreTimesheetCodeDefault1772650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "code" SET DEFAULT ('TM' || LPAD(nextval('timesheet_code_seq')::text, 5, '0'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "code" DROP DEFAULT`,
    );
  }
}
