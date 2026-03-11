import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetRejectionComment1737560400000 implements MigrationInterface {
  name = 'TimesheetRejectionComment1737560400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ADD COLUMN "rejection_comment" character varying(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet" DROP COLUMN IF EXISTS "rejection_comment"
    `);
  }
}
