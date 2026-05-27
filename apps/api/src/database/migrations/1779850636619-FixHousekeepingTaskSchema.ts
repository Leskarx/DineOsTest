import { MigrationInterface, QueryRunner } from "typeorm";

export class FixHousekeepingTaskSchema1779850636619 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
            ALTER TABLE hotel_housekeeping_tasks
            ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_housekeeping_tasks
            ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_housekeeping_tasks
            ALTER COLUMN room_id TYPE uuid USING room_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_housekeeping_tasks
            ALTER COLUMN reservation_id TYPE uuid USING reservation_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_housekeeping_tasks
            ALTER COLUMN assigned_to TYPE text;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

    }

}