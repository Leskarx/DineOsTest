import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, Index,
} from 'typeorm';

export enum ChargeType {
  ROOM_CHARGE = 'room_charge',
  RESTAURANT  = 'restaurant',
  LAUNDRY     = 'laundry',
  MINIBAR     = 'minibar',
  TELEPHONE   = 'telephone',
  SERVICE     = 'service',
  TAX         = 'tax',
  ADVANCE     = 'advance',   // advance payment (negative amount)
  DISCOUNT    = 'discount',  // discount (negative amount)
  SETTLEMENT  = 'settlement',
}

@Entity('hotel_folio_charges')
@Index(['tenantId', 'reservationId'])
export class FolioCharge {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' })       @Index() tenantId: string;
  @Column({ name: 'reservation_id' })  @Index() reservationId: string;

  @Column({ length: 255 })                       description: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) amount: number;

  @Column({ name: 'charge_type', type: 'enum', enum: ChargeType })
  chargeType: ChargeType;

  /** Links to a bill_id, order_id, etc. for cross-reference */
  @Column({ name: 'reference_id', nullable: true, length: 100 }) referenceId: string;

  /** Date the charge applies to (defaults to creation date) */
  @Column({ type: 'date', default: () => 'CURRENT_DATE' }) date: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
