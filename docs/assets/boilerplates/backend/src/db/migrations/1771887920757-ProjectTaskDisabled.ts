import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectTaskDisabled1771887920757 implements MigrationInterface {
  name = 'ProjectTaskDisabled1771887920757';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_tasks" ADD "disabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_tasks" DROP COLUMN "disabled"`,
    );
  }
}
