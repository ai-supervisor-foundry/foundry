import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTasksDeletedAt1771887078544 implements MigrationInterface {
  name = 'ProjectTasksDeletedAt1771887078544';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "project_created_by_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "project_tasks_project_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "project_tasks_assignee_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "project_tasks_created_by_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_user_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_project_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_task_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_approved_by_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "timesheet_entry_timesheet_id_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_audit_event" DROP CONSTRAINT "timesheet_audit_event_timesheet_id_fk"`,
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
      `ALTER TABLE "project" DROP CONSTRAINT "CHK_project_weekly_hours_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" DROP CONSTRAINT "CHK_project_max_hours_per_day_range"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "timesheet_week_boundary_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "timesheet_entry_hours_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "CHK_timesheet_entry_task_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD "deleted_at" TIMESTAMP`,
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
      `ALTER TABLE "timesheet" ALTER COLUMN "version" DROP DEFAULT`,
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
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "FK_68b008b46d5c9f1b49ae92b6f15" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "FK_89de1a5c0f26c99ddf839cc9fa3" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "FK_dc9efb15b07ff6199e629ad4f5a" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "FK_f1982fcf8ecb489419062b10d45" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "FK_31efc1af34b3e429cf9bde584e2" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "FK_16b54e7c131ac0c5023be1d2bbb" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "FK_51d7f506d61908b39398062c5bb" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_audit_event" ADD CONSTRAINT "FK_7c8ec294299101b3acbeb4c2b05" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "timesheet_audit_event" DROP CONSTRAINT "FK_7c8ec294299101b3acbeb4c2b05"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" DROP CONSTRAINT "FK_51d7f506d61908b39398062c5bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "FK_16b54e7c131ac0c5023be1d2bbb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "FK_31efc1af34b3e429cf9bde584e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" DROP CONSTRAINT "FK_f1982fcf8ecb489419062b10d45"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "FK_dc9efb15b07ff6199e629ad4f5a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "FK_89de1a5c0f26c99ddf839cc9fa3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP CONSTRAINT "FK_68b008b46d5c9f1b49ae92b6f15"`,
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
      `ALTER TABLE "timesheet" ALTER COLUMN "version" SET DEFAULT '1'`,
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
      `ALTER TABLE "project_tasks" DROP COLUMN "deleted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "CHK_timesheet_entry_task_type" CHECK (((task_type)::text = ANY ((ARRAY['billable'::character varying, 'nonbillable'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_hours_check" CHECK (((hours >= (0)::numeric) AND (hours <= (8)::numeric)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_week_boundary_check" CHECK (((EXTRACT(dow FROM week_start_date) = (1)::numeric) AND (EXTRACT(dow FROM week_end_date) = (0)::numeric) AND (week_end_date = (week_start_date + '6 days'::interval))))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "CHK_project_max_hours_per_day_range" CHECK (((max_hours_per_day IS NULL) OR ((max_hours_per_day >= 1) AND (max_hours_per_day <= 24))))`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "CHK_project_weekly_hours_range" CHECK (((project_weekly_hours IS NULL) OR ((project_weekly_hours >= 0) AND (project_weekly_hours <= 999))))`,
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
      `ALTER TABLE "timesheet_audit_event" ADD CONSTRAINT "timesheet_audit_event_timesheet_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet_entry" ADD CONSTRAINT "timesheet_entry_timesheet_id_fk" FOREIGN KEY ("timesheet_id") REFERENCES "timesheet"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_approved_by_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project" ADD CONSTRAINT "project_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
