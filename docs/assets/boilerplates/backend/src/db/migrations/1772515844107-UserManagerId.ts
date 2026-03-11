import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserManagerId1772515844107 implements MigrationInterface {
  name = 'UserManagerId1772515844107';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * CONTEXT: A regression was introduced that dropped the default value for timesheet.code.
     * SITUATION: Removing the default on a NOT NULL column caused all new timesheet creation to fail.
     * ACTION: Surgically removed the 'DROP DEFAULT' statement from this migration to preserve the auto-sequencing logic.
     * RESULT: Timesheet creation is restored, and the database schema remains consistent with entity definitions.
     */
    await queryRunner.query(`ALTER TABLE "user" ADD "manager_id" integer`);
    await queryRunner.query(
      `ALTER TYPE "public"."timesheet_status_enum" RENAME TO "timesheet_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."timesheet_status_enum" AS ENUM('draft', 'pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" TYPE "public"."timesheet_status_enum" USING "status"::"text"::"public"."timesheet_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE "public"."timesheet_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_b925754780ce53c20179d7204f9" FOREIGN KEY ("manager_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_b925754780ce53c20179d7204f9"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."timesheet_status_enum_old" AS ENUM('draft', 'pending', 'approved')`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" TYPE "public"."timesheet_status_enum_old" USING "status"::"text"::"public"."timesheet_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE "public"."timesheet_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."timesheet_status_enum_old" RENAME TO "timesheet_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "code" SET DEFAULT ('TM'|| lpad((nextval('timesheet_code_seq')), 5, '0'))`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "manager_id"`);
  }
}
