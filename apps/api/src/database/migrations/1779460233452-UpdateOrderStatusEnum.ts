import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateOrderStatusEnum1779460233452 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add missing enum values to order_status
        await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending'`);
        await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'confirmed'`);
        await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing'`);
        await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'ready'`);
        await queryRunner.query(`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'served'`);
        
        console.log('Added missing enum values to order_status');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Note: PostgreSQL doesn't allow removing enum values directly
        // This would require recreating the enum type
        console.log('Cannot remove enum values, would need to recreate enum type');
        console.log('To revert, run: DROP TYPE order_status CASCADE; then recreate with original values');
    }
}