import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Shift } from './shift.entity';

@Entity('shift_denominations')
export class ShiftDenomination {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'shift_id' }) shiftId: string;
  @ManyToOne(() => Shift, (s) => s.denominations) @JoinColumn({ name: 'shift_id' }) shift: Shift;
  @Column({ name: 'is_opening', default: false }) isOpening: boolean;
  @Column({ name: 'note2000', default: 0 }) note2000: number;
  @Column({ name: 'note500',  default: 0 }) note500: number;
  @Column({ name: 'note200',  default: 0 }) note200: number;
  @Column({ name: 'note100',  default: 0 }) note100: number;
  @Column({ name: 'note50',   default: 0 }) note50: number;
  @Column({ name: 'note20',   default: 0 }) note20: number;
  @Column({ name: 'note10',   default: 0 }) note10: number;
  @Column({ name: 'coin5',    default: 0 }) coin5: number;
  @Column({ name: 'coin2',    default: 0 }) coin2: number;
  @Column({ name: 'coin1',    default: 0 }) coin1: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  get totalAmount(): number {
    return this.note2000 * 2000 + this.note500 * 500 + this.note200 * 200 +
      this.note100 * 100 + this.note50 * 50 + this.note20 * 20 +
      this.note10 * 10 + this.coin5 * 5 + this.coin2 * 2 + this.coin1;
  }
}
