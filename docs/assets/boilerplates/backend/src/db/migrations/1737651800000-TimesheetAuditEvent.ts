import { MigrationInterface, QueryRunner } from 'typeorm';

export class TimesheetAuditEvent1737651800000 implements MigrationInterface {
  name = 'TimesheetAuditEvent1737651800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "timesheet_audit_event" (
        "id" SERIAL NOT NULL,
        "timesheet_id" integer NOT NULL,
        "event_type" character varying(64) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "timesheet_audit_event_pk" PRIMARY KEY ("id"),
        CONSTRAINT "timesheet_audit_event_timesheet_id_fk"
          FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "timesheet_audit_event"`);
  }
}
