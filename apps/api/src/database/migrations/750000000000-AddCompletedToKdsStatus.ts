import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedToKdsStatus1750000000000 implements MigrationInterface {
  name = 'AddCompletedToKdsStatus1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'completed' to the kds_status enum in PostgreSQL
    await queryRunner.query(`
      ALTER TYPE kds_status ADD VALUE IF NOT EXISTS 'completed'
    `);

    // Also add 'recalled' if not already there
    await queryRunner.query(`
      ALTER TYPE kds_status ADD VALUE IF NOT EXISTS 'recalled'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values
    // To rollback you'd need to recreate the enum — skip for now
    console.warn('Cannot remove enum values in PostgreSQL. Manual rollback required.');
  }
}