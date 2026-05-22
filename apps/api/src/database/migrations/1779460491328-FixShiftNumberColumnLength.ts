import { MigrationInterface, QueryRunner } from "typeorm";

export class FixShiftNumberColumnLength1779460491328 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Increase shift_number column length
        await queryRunner.query(`
            ALTER TABLE shifts 
            ALTER COLUMN shift_number TYPE VARCHAR(50)
        `);
        
        console.log('Increased shift_number column length to 50');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert back to VARCHAR(20) - be careful as this may fail if data exceeds 20 chars
        await queryRunner.query(`
            ALTER TABLE shifts 
            ALTER COLUMN shift_number TYPE VARCHAR(20)
        `);
        
        console.log('Reverted shift_number column length to 20');
    }
}