import { MigrationInterface, QueryRunner } from "typeorm";

export class FixShiftTable1779460381366 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // First, ensure shift_number column has enough length
        await queryRunner.query(`
            ALTER TABLE shifts 
            ALTER COLUMN shift_number TYPE VARCHAR(50)
        `);
        
        // Check if shifts table has any open shift
        const openShifts = await queryRunner.query(`
            SELECT COUNT(*) FROM shifts WHERE status = 'open'
        `);
        
        if (parseInt(openShifts[0].count) === 0) {
            console.log('No open shift found, creating default shift...');
            
            // Get the first tenant, branch, and user
            const firstTenant = await queryRunner.query(`
                SELECT id FROM tenants LIMIT 1
            `);
            
            const firstBranch = await queryRunner.query(`
                SELECT id FROM branches LIMIT 1
            `);
            
            const firstUser = await queryRunner.query(`
                SELECT id FROM users LIMIT 1
            `);
            
            if (firstTenant.length > 0 && firstBranch.length > 0 && firstUser.length > 0) {
                // Create a shorter shift number format
                const shiftNumber = `S-${Date.now()}`;
                
                await queryRunner.query(`
                    INSERT INTO shifts (
                        id, 
                        tenant_id, 
                        branch_id, 
                        shift_number, 
                        status, 
                        opened_by, 
                        opening_cash, 
                        opened_at
                    ) VALUES (
                        uuid_generate_v4(),
                        $1, 
                        $2, 
                        $3,
                        'open',
                        $4,
                        0,
                        NOW()
                    )
                `, [firstTenant[0].id, firstBranch[0].id, shiftNumber, firstUser[0].id]);
                
                console.log('Default shift created successfully with number:', shiftNumber);
            } else {
                console.log('Could not create shift: Missing tenant, branch, or user data');
            }
        } else {
            console.log('Open shift already exists');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('No down method needed for this migration');
    }
}