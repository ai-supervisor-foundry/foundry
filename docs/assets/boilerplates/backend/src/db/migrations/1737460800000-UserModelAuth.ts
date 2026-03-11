import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserModelAuth1737460800000 implements MigrationInterface {
  name = 'UserModelAuth1737460800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_role_enum" AS ENUM ('ADMIN', 'MANAGER', 'USER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_status_enum" AS ENUM ('active', 'inactive');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    const table = await queryRunner.getTable('user');
    if (!table) {
      await queryRunner.query(`
        CREATE TABLE "user" (
          "id" SERIAL NOT NULL,
          "name" character varying NOT NULL,
          "email" character varying NOT NULL,
          "password_hash" character varying,
          "role" "user_role_enum" NOT NULL DEFAULT 'USER',
          "status" "user_status_enum" NOT NULL DEFAULT 'active',
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "deleted_at" TIMESTAMP,
          CONSTRAINT "user_pk" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "user_email_uc" ON "user" ("email") WHERE deleted_at IS NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum"`);
  }
}
