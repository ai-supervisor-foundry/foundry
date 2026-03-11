import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectAccessType1737600000000 implements MigrationInterface {
  name = 'ProjectAccessType1737600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "project_access_type_enum" AS ENUM ('all', 'restricted');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "project"
      ADD COLUMN IF NOT EXISTS "access_type" "project_access_type_enum" NOT NULL DEFAULT 'all'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "project_allowed_user" (
        "project_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        CONSTRAINT "project_allowed_user_pk" PRIMARY KEY ("project_id", "user_id"),
        CONSTRAINT "project_allowed_user_project_fk" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
        CONSTRAINT "project_allowed_user_user_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "project_allowed_user"`);
    await queryRunner.query(
      `ALTER TABLE "project" DROP COLUMN IF EXISTS "access_type"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "project_access_type_enum"`);
  }
}
