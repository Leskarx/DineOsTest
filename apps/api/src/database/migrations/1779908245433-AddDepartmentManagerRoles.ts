import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepartmentManagerRoles1779908245433 implements MigrationInterface {
    name = 'AddDepartmentManagerRoles1779908245433'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'restaurant_manager'`);
        await queryRunner.query(`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'hotel_manager'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres does not support removing values from an enum type safely,
        // so we leave it empty. Dropping and recreating the enum is risky if data exists.
    }
}
