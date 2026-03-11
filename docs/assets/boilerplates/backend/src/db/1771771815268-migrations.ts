import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1771771815268 implements MigrationInterface {
  name = 'Migrations1771771815268';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "project_created_by_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_user_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_project_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "timesheet_entry_timesheet_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" DROP CONSTRAINT "project_allowed_user_project_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" DROP CONSTRAINT "project_allowed_user_user_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "project_dates_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_week_boundary_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "timesheet_entry_hours_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "UQ_b58774a8460d69d09c888158ab1" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "UQ_92beedfb0fd74bcae707854206c" UNIQUE ("code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "code" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fc4ee644c09737531d5d97a749" ON "project_allowed_user" ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4ac1f4e0de61cd0124488ca723" ON "project_allowed_user" ("user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "FK_1778afd0b8f381a6aa80b444519" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "FK_f1982fcf8ecb489419062b10d45" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "FK_31efc1af34b3e429cf9bde584e2" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "FK_51d7f506d61908b39398062c5bb" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" ADD CONSTRAINT "FK_fc4ee644c09737531d5d97a7493" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" ADD CONSTRAINT "FK_4ac1f4e0de61cd0124488ca7235" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" DROP CONSTRAINT "FK_4ac1f4e0de61cd0124488ca7235"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" DROP CONSTRAINT "FK_fc4ee644c09737531d5d97a7493"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "FK_51d7f506d61908b39398062c5bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "FK_31efc1af34b3e429cf9bde584e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "FK_f1982fcf8ecb489419062b10d45"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "FK_1778afd0b8f381a6aa80b444519"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4ac1f4e0de61cd0124488ca723"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fc4ee644c09737531d5d97a749"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ALTER COLUMN "code" SET DEFAULT ('TM'|| lpad((nextval('timesheet_code_seq')), 5, '0'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "UQ_92beedfb0fd74bcae707854206c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "UQ_b58774a8460d69d09c888158ab1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_hours_check" CHECK (((hours >= (0)::numeric) AND (hours <= (8)::numeric)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_week_boundary_check" CHECK (((EXTRACT(dow FROM week_start_date) = (1)::numeric) AND (EXTRACT(dow FROM week_end_date) = (0)::numeric) AND (week_end_date = (week_start_date + '6 days'::interval))))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "project_dates_check" CHECK (((end_date IS NULL) OR (start_date IS NULL) OR (end_date >= start_date)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" ADD CONSTRAINT "project_allowed_user_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_allowed_user" ADD CONSTRAINT "project_allowed_user_project_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_timesheet_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "project_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
