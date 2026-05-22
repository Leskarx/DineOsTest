import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bill, GstType, InvoiceStatus } from './entities/bill.entity';
import { Payment, PaymentMethod } from './entities/payment.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Branch } from '../branches/entities/branch.entity';
import { MailerService } from '../mailer/mailer.service';
import { PdfService } from './pdf.service';

export interface PaymentSplitDto {
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
  cardLast4?: string;
  upiId?: string;
  walletName?: string;
}

export interface CreateBillDto {
  orderId: string;
  tenantId: string;
  branchId: string;
  shiftId?: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  supplyType?: GstType;
  payments: PaymentSplitDto[];
  notes?: string;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Bill) private readonly billRepo: Repository<Bill>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    @InjectRepository(Shift) private readonly shiftRepo: Repository<Shift>,
    @InjectRepository(Branch) private readonly branchRepo: Repository<Branch>,
    private readonly dataSource: DataSource,
    private readonly mailer: MailerService,
    private readonly pdf: PdfService,
  ) {}

  async createBill(dto: CreateBillDto): Promise<Bill> {
    const order = await this.orderRepo.findOne({
      where: { id: dto.orderId, tenantId: dto.tenantId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.BILLED) throw new BadRequestException('Order already billed');
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');

    const totalPaid = dto.payments.reduce((s, p) => s + p.amount, 0);
    if (totalPaid < Number(order.grandTotal) - 0.01) {
      throw new BadRequestException(`Insufficient payment. Expected ₹${order.grandTotal}, got ₹${totalPaid}`);
    }

    return this.dataSource.transaction(async (em) => {
      const billNumber = await this.generateBillNumber(dto.branchId, em);

      // Compute the same discount ratio used in recalculateTotals so the
      // per-rate GST summary on the bill reflects the discounted taxable base.
      const discountRatio = Number(order.subtotal) > 0
        ? Number(order.discountAmount) / Number(order.subtotal)
        : 0;
      const gstSummary = this.buildGstSummary(order.items.filter((i) => !i.isVoided), discountRatio);
      const supplyType = dto.customerGstin ? GstType.IGST : (dto.supplyType || GstType.CGST_SGST);

      const bill = em.create(Bill, {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        orderId: dto.orderId,
        shiftId: dto.shiftId,
        billNumber,
        invoiceNumber: billNumber,
        status: InvoiceStatus.PAID,
        customerName: dto.customerName || order.customerName,
        customerPhone: dto.customerPhone || order.customerPhone,
        customerGstin: dto.customerGstin || order.customerGstin,
        customerAddress: dto.customerAddress,
        supplyType,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        taxableAmount: order.taxableAmount,
        cgstAmount: supplyType === GstType.IGST ? 0 : order.cgstAmount,
        sgstAmount: supplyType === GstType.IGST ? 0 : order.sgstAmount,
        igstAmount: supplyType === GstType.IGST ? Number(order.cgstAmount) + Number(order.sgstAmount) : order.igstAmount,
        cessAmount: order.cessAmount,
        totalTax: order.totalTax,
        roundOff: order.roundOff,
        grandTotal: order.grandTotal,
        paidAmount: totalPaid,
        changeAmount: Math.max(0, totalPaid - Number(order.grandTotal)),
        gstSummary,
        notes: dto.notes,
      });

      await em.save(bill);

      const payments = dto.payments.map((p) =>
        em.create(Payment, {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          billId: bill.id,
          orderId: dto.orderId,
          shiftId: dto.shiftId,
          method: p.method,
          amount: p.amount,
          referenceNo: p.referenceNo,
          cardLast4: p.cardLast4,
          upiId: p.upiId,
          walletName: p.walletName,
          isSplit: dto.payments.length > 1,
        }),
      );
      await em.save(payments);

      order.status = OrderStatus.BILLED;
      order.billedAt = new Date();
      if (dto.shiftId) order.shiftId = dto.shiftId;
      await em.save(order);

      if (dto.shiftId) await this.updateShiftTotals(dto.shiftId, bill, dto.payments, em);

      return bill;
    });
  }

  async getBill(billId: string, tenantId: string) {
    const bill = await this.billRepo.findOne({
      where: { id: billId, tenantId },
      relations: ['payments'],
    });
    if (!bill) throw new NotFoundException('Bill not found');

    const order = await this.orderRepo.findOne({
      where: { id: bill.orderId },
      relations: ['items'],
    });
    return { ...bill, orderItems: order?.items.filter((i) => !i.isVoided) };
  }

  async listBills(
    branchId: string,
    tenantId: string,
    from?: Date,
    to?: Date,
    page = 1,
    limit = 50,
  ) {
    const qb = this.billRepo.createQueryBuilder('b')
      .where('b.branch_id = :branchId AND b.tenant_id = :tenantId', { branchId, tenantId })
      .orderBy('b.created_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);
    if (from) qb.andWhere('b.created_at >= :from', { from });
    if (to) qb.andWhere('b.created_at <= :to', { to });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async voidBill(billId: string, tenantId: string, reason: string) {
    const bill = await this.billRepo.findOne({ where: { id: billId, tenantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === InvoiceStatus.VOID) throw new BadRequestException('Already voided');
    bill.status = InvoiceStatus.VOID;
    bill.notes = `VOIDED: ${reason}`;
    return this.billRepo.save(bill);
  }

  /**
   * Builds a per-GST-rate summary for the bill PDF / email.
   *
   * @param items    Active (non-voided) order items — amounts are always stored
   *                 at full pre-discount value (recalculateTotals never mutates items).
   * @param discountRatio  Fraction of the subtotal that was discounted (0–1).
   *                       Applied proportionally to each amount so the printed
   *                       GST summary matches the discounted taxable base.
   */
  private buildGstSummary(items: OrderItem[], discountRatio = 0) {
    const scale = 1 - discountRatio;
    const groups = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; igst: number }>();
    for (const item of items) {
      const rate = Number(item.gstRate);
      const existing = groups.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      existing.taxable += Number(item.taxableAmount) * scale;
      existing.cgst += Number(item.cgstAmount) * scale;
      existing.sgst += Number(item.sgstAmount) * scale;
      existing.igst += Number(item.igstAmount) * scale;
      groups.set(rate, existing);
    }
    return Array.from(groups.values()).map((g) => ({
      gstRate: g.rate,
      taxableAmount: g.taxable.toFixed(2),
      cgstAmount: g.cgst.toFixed(2),
      sgstAmount: g.sgst.toFixed(2),
      igstAmount: g.igst.toFixed(2),
      totalTax: (g.cgst + g.sgst + g.igst).toFixed(2),
    }));
  }

  private async updateShiftTotals(shiftId: string, bill: Bill, payments: PaymentSplitDto[], em: any) {
    const shift = await em.findOne(Shift, { where: { id: shiftId } });
    if (!shift) return;
    shift.totalSales = Number(shift.totalSales) + Number(bill.grandTotal);
    shift.totalOrders = Number(shift.totalOrders) + 1;
    for (const p of payments) {
      if (p.method === 'cash') shift.cashSales = Number(shift.cashSales) + p.amount;
      else if (p.method === 'card') shift.cardSales = Number(shift.cardSales) + p.amount;
      else if (p.method === 'upi') shift.upiSales = Number(shift.upiSales) + p.amount;
      else if (p.method === 'wallet') shift.walletSales = Number(shift.walletSales) + p.amount;
      else if (p.method === 'credit') shift.creditSales = Number(shift.creditSales) + p.amount;
      else if (p.method === 'complimentary') shift.complimentary = Number(shift.complimentary) + p.amount;
    }
    shift.totalCgst = Number(shift.totalCgst) + Number(bill.cgstAmount);
    shift.totalSgst = Number(shift.totalSgst) + Number(bill.sgstAmount);
    shift.totalIgst = Number(shift.totalIgst) + Number(bill.igstAmount);
    await em.save(shift);
  }

  async emailBill(billId: string, tenantId: string, toEmail: string): Promise<{ sent: boolean }> {
    const bill = await this.billRepo.findOne({ where: { id: billId, tenantId }, relations: ['payments'] });
    if (!bill) throw new NotFoundException('Bill not found');

    const order  = await this.orderRepo.findOne({ where: { id: bill.orderId }, relations: ['items'] });
    const branch = await this.branchRepo.findOne({ where: { id: bill.branchId } });

    const items = (order?.items ?? [])
      .filter((i) => !i.isVoided)
      .map((i) => ({
        name:  i.name,
        qty:   i.quantity,
        rate:  Number(i.unitPrice),
        total: Number(i.lineTotal),
      }));

    const payments = (bill.payments ?? []).map((p) => ({
      method: p.method,
      amount: Number(p.amount),
    }));

    const invoiceData = {
      billNumber:   bill.billNumber,
      issuedAt:     bill.issuedAt ?? new Date(),
      customerName: bill.customerName || 'Valued Customer',
      customerPhone: bill.customerPhone ?? undefined,
      branchName:   branch?.name ?? 'Our Restaurant',
      branchAddress: branch?.addressLine1 ?? undefined,
      gstin:        (branch as any)?.gstin ?? undefined,
      items,
      payments,
      subtotal:   items.reduce((s, i) => s + i.total, 0),
      cgst:       Number(bill.cgstAmount),
      sgst:       Number(bill.sgstAmount),
      igst:       Number(bill.igstAmount),
      grandTotal: Number(bill.grandTotal),
    };

    // Generate PDF — gracefully degrade to HTML-only if generation fails
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.pdf.generateInvoicePdf(invoiceData);
    } catch {
      // PDF generation failure must not block the email from sending
    }

    const sent = await this.mailer.sendBillEmail({
      to:           toEmail,
      customerName: invoiceData.customerName,
      billNumber:   bill.billNumber,
      grandTotal:   Number(bill.grandTotal),
      branchName:   invoiceData.branchName,
      items,
      payments,
      cgst:         Number(bill.cgstAmount),
      sgst:         Number(bill.sgstAmount),
      igst:         Number(bill.igstAmount),
      issuedAt:     bill.issuedAt,
      // PDF attachment
      ...(pdfBuffer ? {
        attachments: [{
          filename:    `Invoice-${bill.billNumber}.pdf`,
          content:     pdfBuffer,
          contentType: 'application/pdf',
        }],
      } : {}),
    });

    return { sent };
  }

  async reprintBill(billId: string, tenantId: string): Promise<Bill> {
    const bill = await this.billRepo.findOne({ where: { id: billId, tenantId }, relations: ['payments'] });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === InvoiceStatus.VOID) throw new BadRequestException('Cannot reprint a voided bill');

    bill.printedCount = (bill.printedCount || 0) + 1;
    bill.printedAt = new Date();
    return this.billRepo.save(bill);
  }

  /**
   * Generates a unique bill number inside an existing transaction.
   * Uses a PostgreSQL transaction-scoped advisory lock (released on commit/rollback)
   * to prevent concurrent billing from claiming the same sequence number.
   * The lock key is namespaced separately from the order sequence lock.
   */
  private async generateBillNumber(branchId: string, em: any): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    const [{ lock_key }] = await em.query(
      `SELECT abs(hashtext($1))::bigint AS lock_key`,
      [`bill_seq:${branchId}`],
    );
    await em.query(`SELECT pg_advisory_xact_lock($1)`, [lock_key]);

    const [{ count }] = await em.query(
      `SELECT COUNT(*)::int AS count FROM bills WHERE branch_id = $1`,
      [branchId],
    );
    return `BILL-${today}-${String(Number(count) + 1).padStart(5, '0')}`;
  }
}
