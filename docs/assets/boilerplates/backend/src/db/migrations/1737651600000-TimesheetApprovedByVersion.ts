import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetApprovedByVersion1737651600000 implements MigrationInterface {
  name = 'TimesheetApprovedByVersion1737651600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ADD COLUMN "approved_by_id" integer NULL,
      ADD COLUMN "approved_at" TIMESTAMP NULL,
      ADD COLUMN "version" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ADD CONSTRAINT "timesheet_approved_by_id_fk"
      FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT IF EXISTS "timesheet_approved_by_id_fk"`,
    );
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      DROP COLUMN IF EXISTS "approved_by_id",
      DROP COLUMN IF EXISTS "approved_at",
      DROP COLUMN IF EXISTS "version"
    `);
  }
}
