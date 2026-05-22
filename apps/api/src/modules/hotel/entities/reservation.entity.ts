import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Room }  from './room.entity';
import { Guest } from './guest.entity';

export enum ReservationStatus {
  CONFIRMED   = 'confirmed',
  CHECKED_IN  = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED   = 'cancelled',
  NO_SHOW     = 'no_show',
}

export enum BookingSource {
  WALK_IN  = 'walk_in',
  PHONE    = 'phone',
  OTA      = 'ota',        // OYO, MakeMyTrip, etc.
  WEBSITE  = 'website',
  AGENT    = 'agent',
}

@Entity('hotel_reservations')
@Index(['tenantId', 'branchId'])
@Index(['tenantId', 'checkInDate'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'branch_id' })           branchId: string;

  @Column({ name: 'room_id' })             roomId: string;
  @ManyToOne(() => Room)
  @JoinColumn({ name: 'room_id' })         room: Room;

  @Column({ name: 'primary_guest_id' })    primaryGuestId: string;
  @ManyToOne(() => Guest)
  @JoinColumn({ name: 'primary_guest_id' }) primaryGuest: Guest;

  @Column({ name: 'num_adults', type: 'smallint', default: 1 })  numAdults: number;
  @Column({ name: 'num_children', type: 'smallint', default: 0 }) numChildren: number;

  /** Dates stored as DATE (no time) — YYYY-MM-DD */
  @Column({ name: 'check_in_date',  type: 'date' }) checkInDate: string;
  @Column({ name: 'check_out_date', type: 'date' }) checkOutDate: string;

  /** Actual timestamps recorded when front-desk clicks Check-in / Check-out */
  @Column({ name: 'actual_check_in',  nullable: true }) actualCheckIn: Date;
  @Column({ name: 'actual_check_out', nullable: true }) actualCheckOut: Date;

  @Column({
    type: 'enum', enum: ReservationStatus,
    default: ReservationStatus.CONFIRMED,
  }) status: ReservationStatus;

  @Column({ name: 'rate_per_night', type: 'numeric', precision: 12, scale: 2 })
  ratePerNight: number;

  @Column({ name: 'num_nights', type: 'smallint' }) numNights: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })           subtotal: number;
  @Column({ name: 'tax_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxAmount: number;
  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount: number;
  @Column({ name: 'advance_paid', type: 'numeric', precision: 12, scale: 2, default: 0 })
  advancePaid: number;
  @Column({ name: 'balance_due', type: 'numeric', precision: 12, scale: 2 })
  balanceDue: number;

  @Column({
    type: 'enum', enum: BookingSource,
    default: BookingSource.WALK_IN,
  }) source: BookingSource;

  /** External reference (OTA booking ID, channel manager ref, etc.) */
  @Column({ name: 'booking_ref', nullable: true, length: 100 }) bookingRef: string;

  @Column({ name: 'special_requests', nullable: true, type: 'text' }) specialRequests: string;
  @Column({ nullable: true, type: 'text' })                             notes: string;

  @Column({ name: 'cancelled_at', nullable: true })  cancelledAt: Date;
  @Column({ name: 'cancel_reason', nullable: true, type: 'text' }) cancelReason: string;

  @Column({ name: 'created_by_id', nullable: true }) createdById: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
