import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { RoomType } from './room-type.entity';

export enum RoomStatus {
  AVAILABLE   = 'available',
  OCCUPIED    = 'occupied',
  RESERVED    = 'reserved',
  CLEANING    = 'cleaning',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out_of_order',
}

@Entity('hotel_rooms')
@Index(['tenantId', 'branchId', 'roomNumber'], { unique: true })
export class Room {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id' })           branchId: string;

  @Column({ name: 'room_type_id' })        roomTypeId: string;
  @ManyToOne(() => RoomType)
  @JoinColumn({ name: 'room_type_id' })
  roomType: RoomType;

  @Column({ name: 'room_number', length: 20 }) roomNumber: string;
  @Column({ type: 'smallint', default: 1 })    floor: number;

  @Column({
    type: 'enum', enum: RoomStatus,
    default: RoomStatus.AVAILABLE,
  }) status: RoomStatus;

  /** Override amenities at room level (null = inherit from type) */
  @Column({ name: 'amenities_override', type: 'jsonb', nullable: true }) amenitiesOverride: string[] | null;

  @Column({ nullable: true, type: 'text' }) notes: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
