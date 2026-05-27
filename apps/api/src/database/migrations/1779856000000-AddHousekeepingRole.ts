import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHousekeepingRole1779856000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'housekeeping'`);
        console.log('Added housekeeping value to user_role enum');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL doesn't allow removing enum values directly
        console.log('Cannot remove enum values, would need to recreate enum type');
    }
}
