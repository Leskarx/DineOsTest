import { MigrationInterface, QueryRunner } from "typeorm";

export class FixHotelReservationUuidColumns1779840586946 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
            ALTER TABLE hotel_reservations
            ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_reservations
            ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_reservations
            ALTER COLUMN room_id TYPE uuid USING room_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_reservations
            ALTER COLUMN primary_guest_id TYPE uuid USING primary_guest_id::uuid;
        `);

        await queryRunner.query(`
            ALTER TABLE hotel_reservations
            ALTER COLUMN created_by_id TYPE uuid USING created_by_id::uuid;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}