import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum IdType {
  AADHAAR  = 'aadhaar',
  PASSPORT = 'passport',
  DL       = 'driving_license',
  VOTER_ID = 'voter_id',
  PAN      = 'pan',
  OTHER    = 'other',
}

export enum Gender { MALE = 'male', FEMALE = 'female', OTHER = 'other' }

@Entity('hotel_guests')
@Index(['tenantId'])
export class Guest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;

  @Column({ length: 150 })                   name: string;
  @Column({ length: 20 })                    phone: string;
  @Column({ nullable: true, length: 200 })   email: string;

  @Column({ name: 'id_type', type: 'enum', enum: IdType, nullable: true })
  idType: IdType;

  @Column({ name: 'id_number', nullable: true, length: 50 }) idNumber: string;

  @Column({ nullable: true, default: 'India', length: 60 }) nationality: string;

  @Column({ nullable: true, type: 'text' })   address: string;
  @Column({ nullable: true, length: 80 })     city: string;
  @Column({ nullable: true, length: 60 })     state: string;
  @Column({ nullable: true, length: 10 })     pincode: string;

  @Column({ nullable: true, type: 'date' })   dob: string;
  @Column({ type: 'enum', enum: Gender, nullable: true }) gender: Gender;

  /** Lifetime stays — incremented by the reservation service on checkout */
  @Column({ name: 'total_stays', default: 0 }) totalStays: number;

  @CreateDateColumn({ name: 'created_at' })  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })  updatedAt: Date;
}
