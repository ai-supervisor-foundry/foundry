import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restore default for timesheet.code (sequence-generated TM00001, ...).
 * A prior generated migration had dropped it, causing NOT NULL violation on create.
 */
export class TimesheetCodeDefault1771888500000 implements MigrationInterface {
  name = 'TimesheetCodeDefault1771888500000';

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
