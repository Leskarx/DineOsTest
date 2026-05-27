import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReceptionistRole1779865000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'receptionist'`);
        console.log('Added receptionist value to user_role enum');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL doesn't allow removing enum values directly
        console.log('Cannot remove enum values, would need to recreate enum type');
    }
}
