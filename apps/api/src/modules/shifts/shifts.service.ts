import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Shift, ShiftStatus } from './entities/shift.entity';
import { ShiftDenomination } from './entities/shift-denomination.entity';

export interface DenominationDto {
  note2000?: number; note500?: number; note200?: number; note100?: number;
  note50?: number; note20?: number; note10?: number;
  coin5?: number; coin2?: number; coin1?: number;
}

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(ShiftDenomination) private readonly denomRepo: Repository<ShiftDenomination>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async openShift(branchId: string, tenantId: string, userId: string, openingCash: number, denominations?: DenominationDto) {
    const existing = await this.shiftRepo.findOne({
      where: { branchId, tenantId, status: ShiftStatus.OPEN },
    });
    if (existing) throw new BadRequestException('A shift is already open for this branch');

    // Generate shift number inside a transaction with an advisory lock so
    // two concurrent openShift calls for the same branch cannot read the
    // same COUNT and produce duplicate shift numbers.
    const shiftNumber = await this.db.transaction(async (em) => {
      const [{ lock_key }] = await em.query(
        `SELECT abs(hashtext($1))::bigint AS lock_key`,
        [`shift_seq:${branchId}`],
      );
      await em.query(`SELECT pg_advisory_xact_lock($1)`, [lock_key]);
      const [{ count }] = await em.query(
        `SELECT COUNT(*)::int AS count FROM shifts WHERE branch_id = $1 AND tenant_id = $2`,
        [branchId, tenantId],
      );
      return `SH-${String(Number(count) + 1).padStart(4, '0')}`;
    });

    const shift = this.shiftRepo.create({
      tenantId,
      branchId,
      shiftNumber,
      openedBy: userId,
      openingCash,
      status: ShiftStatus.OPEN,
    });
    await this.shiftRepo.save(shift);

    if (denominations) {
      const denom = this.denomRepo.create({ ...denominations, shiftId: shift.id, isOpening: true });
      await this.denomRepo.save(denom);
    }

    return shift;
  }

  async closeShift(
    shiftId: string,
    tenantId: string,
    userId: string,
    closingCash: number,
    denominations?: DenominationDto,
    notes?: string,
  ) {
    const shift = await this.shiftRepo.findOne({ where: { id: shiftId, tenantId, status: ShiftStatus.OPEN } });
    if (!shift) throw new NotFoundException('Open shift not found');

    const expectedCash = Number(shift.openingCash) + Number(shift.cashSales) - Number(shift.totalRefund);

    shift.status = ShiftStatus.CLOSED;
    shift.closedBy = userId;
    shift.closingCash = closingCash;
    shift.expectedCash = expectedCash;
    shift.cashDifference = closingCash - expectedCash;
    shift.closedAt = new Date();
    if (notes !== undefined) shift.notes = notes;

    await this.shiftRepo.save(shift);

    if (denominations) {
      const denom = this.denomRepo.create({ ...denominations, shiftId: shift.id, isOpening: false });
      await this.denomRepo.save(denom);
    }

    return this.getShiftSummary(shift.id, tenantId);
  }

  async getActiveShift(branchId: string, tenantId: string) {
    return this.shiftRepo.findOne({
      where: { branchId, tenantId, status: ShiftStatus.OPEN },
      relations: ['denominations'],
    });
  }

  async getShiftSummary(shiftId: string, tenantId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, tenantId },
      relations: ['denominations'],
    });
    if (!shift) throw new NotFoundException('Shift not found');

    return {
      ...shift,
      paymentBreakdown: {
        cash: shift.cashSales,
        card: shift.cardSales,
        upi: shift.upiSales,
        wallet: shift.walletSales,
        credit: shift.creditSales,
        complimentary: shift.complimentary,
      },
      gstBreakdown: {
        cgst: shift.totalCgst,
        sgst: shift.totalSgst,
        igst: shift.totalIgst,
        total: Number(shift.totalCgst) + Number(shift.totalSgst) + Number(shift.totalIgst),
      },
    };
  }

  async listShifts(branchId: string, tenantId: string, limit = 20) {
    return this.shiftRepo.find({
      where: { branchId, tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
