import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetCommentsLength5121772300000000 implements MigrationInterface {
  name = 'TimesheetCommentsLength5121772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ALTER COLUMN "comments" TYPE character varying(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "timesheet"
      ALTER COLUMN "comments" TYPE character varying(500)
    `);
  }
}
