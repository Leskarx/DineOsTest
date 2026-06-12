import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import {
  Bill, GstType, InvoiceStatus, OrderType, DeliveryPaymentType,
} from './entities/bill.entity';
import { Payment, PaymentMethod } from './entities/payment.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Shift } from '../shifts/entities/shift.entity';
import { Branch } from '../branches/entities/branch.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { MailerService } from '../mailer/mailer.service';
import { PdfService } from './pdf.service';
const Razorpay = require('razorpay');

export interface PaymentSplitDto {
  method: PaymentMethod;
  amount: number;
  referenceNo?: string;
  cardLast4?: string;
  upiId?: string;
  walletName?: string;
}

export interface CreateBillDto {
  orderId:              string;
  tenantId:             string;
  branchId:             string;
  shiftId?:             string;
  customerName?:        string;
  customerPhone?:       string;
  customerGstin?:       string;
  customerAddress?:     string;
  deliveryAddress?:     string;
  deliveryPaymentType?: 'cod' | 'prepaid';
  supplyType?:          GstType;
  payments:             PaymentSplitDto[];
  notes?:               string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Bill)      private readonly billRepo:    Repository<Bill>,
    @InjectRepository(Payment)   private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)     private readonly orderRepo:   Repository<Order>,
    @InjectRepository(OrderItem) private readonly itemRepo:    Repository<OrderItem>,
    @InjectRepository(Shift)     private readonly shiftRepo:   Repository<Shift>,
    @InjectRepository(Branch)    private readonly branchRepo:  Repository<Branch>,
    @InjectRepository(Tenant)    private readonly tenantRepo:  Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly mailer:     MailerService,
    private readonly pdf:        PdfService,
  ) {}

  /* ── Create Bill ─────────────────────────────────────────────────────── */
  async createBill(dto: CreateBillDto): Promise<any> {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(dto.orderId)) {
      throw new BadRequestException(
        `Invalid orderId "${dto.orderId}". Offline orders must be synced before billing.`,
      );
    }

    const { isOfflineSync, ...cleanDto } = dto as any;
    dto = cleanDto;

    const order = await this.orderRepo.findOne({
      where: { id: dto.orderId, tenantId: dto.tenantId },
      relations: ['items', 'table'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.BILLED)    throw new BadRequestException('Order already billed');
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');

    let effectiveGrandTotal = Number(order.grandTotal);
    if (isOfflineSync) {
      const recalculated = order.items
        .filter((i) => !i.isVoided)
        .reduce((sum, i) => sum + Number(i.lineTotal), 0);

      if (recalculated > 0) effectiveGrandTotal = Math.round(recalculated * 100) / 100;

      if (dto.payments?.length > 0) {
        const currentTotal = dto.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        const diff = effectiveGrandTotal - currentTotal;
        if (Math.abs(diff) > 0.01 && Math.abs(diff) < 2) {
          dto.payments = [
            { ...dto.payments[0], amount: Number(dto.payments[0].amount) + diff },
            ...dto.payments.slice(1),
          ];
        }
      }
    }

    const totalPaid = dto.payments.reduce((s, p) => s + Number(p.amount), 0);

    // COD: payment collected on delivery — skip payment sufficiency check
    const isCod = dto.deliveryPaymentType === 'cod';
    if (!isOfflineSync && !isCod && totalPaid < effectiveGrandTotal - 0.01) {
      throw new BadRequestException(
        `Insufficient payment. Expected ₹${effectiveGrandTotal.toFixed(2)}, got ₹${totalPaid.toFixed(2)}`,
      );
    }

    return this.dataSource.transaction(async (em) => {
      const billNumber = await this.generateBillNumber(dto.tenantId, dto.branchId, em);

      const discountRatio = Number(order.subtotal) > 0
        ? Number(order.discountAmount) / Number(order.subtotal)
        : 0;

      const gstSummary = this.buildGstSummary(
        order.items.filter((i) => !i.isVoided),
        discountRatio,
      );

      const supplyType = dto.customerGstin
        ? GstType.IGST
        : (dto.supplyType || GstType.CGST_SGST);

      const deliveryAddress =
        dto.deliveryAddress ||
        (order as any).deliveryAddress ||
        null;

      const deliveryPaymentType = dto.deliveryPaymentType
        ? (dto.deliveryPaymentType as DeliveryPaymentType)
        : null;

      const bill = em.create(Bill, {
        tenantId:        dto.tenantId,
        branchId:        dto.branchId,
        orderId:         dto.orderId,
        shiftId:         dto.shiftId,
        billNumber,
        invoiceNumber:   billNumber,
        status:          InvoiceStatus.PAID,

        // Store order type + delivery info directly on the bill
        orderType:           (order.type as OrderType) ?? OrderType.DINE_IN,
        deliveryAddress,
        deliveryPaymentType,

        customerName:    dto.customerName    || order.customerName,
        customerPhone:   dto.customerPhone   || order.customerPhone,
        customerGstin:   dto.customerGstin   || order.customerGstin,
        customerAddress: dto.customerAddress,
        supplyType,
        subtotal:        order.subtotal,
        discountAmount:  order.discountAmount,
        taxableAmount:   order.taxableAmount,
        cgstAmount:      supplyType === GstType.IGST ? 0 : order.cgstAmount,
        sgstAmount:      supplyType === GstType.IGST ? 0 : order.sgstAmount,
        igstAmount:      supplyType === GstType.IGST
          ? Number(order.cgstAmount) + Number(order.sgstAmount)
          : order.igstAmount,
        cessAmount:      order.cessAmount,
        totalTax:        order.totalTax,
        roundOff:        order.roundOff,
        grandTotal:      isOfflineSync ? effectiveGrandTotal : order.grandTotal,
        paidAmount:      totalPaid,
        changeAmount:    Math.max(
          0,
          totalPaid - (isOfflineSync ? effectiveGrandTotal : Number(order.grandTotal)),
        ),
        gstSummary,
        notes: dto.notes,
      });

      await em.save(bill);

      const payments = dto.payments.map((p) =>
        em.create(Payment, {
          tenantId:    dto.tenantId,
          branchId:    dto.branchId,
          billId:      bill.id,
          orderId:     dto.orderId,
          shiftId:     dto.shiftId,
          method:      p.method,
          amount:      p.amount,
          referenceNo: p.referenceNo,
          cardLast4:   p.cardLast4,
          upiId:       p.upiId,
          walletName:  p.walletName,
          isSplit:     dto.payments.length > 1,
        }),
      );
      await em.save(payments);

      order.status   = OrderStatus.BILLED;
      order.billedAt = new Date();
      if (dto.shiftId) order.shiftId = dto.shiftId;
      await em.save(order);

      if (dto.shiftId) {
        await this.updateShiftTotals(dto.shiftId, bill, dto.payments, em);
      }

      return { ...bill, payments };
    });
  }

  /* ── Get Bill detail ─────────────────────────────────────────────────── */
  async getBill(billId: string, tenantId: string) {
    const bill = await this.billRepo.findOne({
      where: { id: billId, tenantId },
      relations: ['payments'],
    });
    if (!bill) throw new NotFoundException('Bill not found');

    const order = bill.orderId
      ? await this.orderRepo.findOne({
          where: { id: bill.orderId },
          relations: ['items', 'table'],
        })
      : null;

    const orderItems = order?.items.filter((i) => !i.isVoided) ?? [];

    return {
      ...bill,
      orderType:           bill.orderType           ?? order?.type          ?? 'dine_in',
      deliveryAddress:     bill.deliveryAddress      ?? (order as any)?.deliveryAddress ?? null,
      deliveryPaymentType: bill.deliveryPaymentType  ?? null,
      customerPhone:       bill.customerPhone        ?? order?.customerPhone ?? null,
      customerName:        bill.customerName         ?? order?.customerName  ?? null,
      tableName:           order?.table?.name        ?? null,
      orderItems,
    };
  }

  /* ── List Bills ──────────────────────────────────────────────────────── */
  /* Uses findAndCount instead of QueryBuilder to avoid a TypeORM bug where
     ordering by a column that sits next to a newly-added enum column causes
     "Cannot read properties of undefined (reading 'databaseName')".       */
  async listBills(
    branchId: string,
    tenantId: string,
    from?: Date,
    to?: Date,
    page = 1,
    limit = 50,
    source?: string,
  ) {
    // Build the where clause
    const where: any = { tenantId };
    if (branchId) where.branchId = branchId;
    if (source)   where.source   = source;

    // Date range
    if (from && to)  where.createdAt = Between(from, to);
    else if (from)   where.createdAt = MoreThanOrEqual(from);
    else if (to)     where.createdAt = LessThanOrEqual(to);

    const [data, total] = await this.billRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take:  limit,
      skip:  (page - 1) * limit,
      // Include payments in list so frontend can detect COD from referenceNo if needed
      relations: ['payments'],
    });

    return { data, total, page, limit };
  }

  /* ── Void ────────────────────────────────────────────────────────────── */
  async voidBill(billId: string, tenantId: string, reason: string) {
    const bill = await this.billRepo.findOne({ where: { id: billId, tenantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === InvoiceStatus.VOID) throw new BadRequestException('Already voided');
    bill.status = InvoiceStatus.VOID;
    bill.notes  = `VOIDED: ${reason}`;
    return this.billRepo.save(bill);
  }

  /* ── Email ───────────────────────────────────────────────────────────── */
  async emailBill(billId: string, tenantId: string, toEmail: string): Promise<{ sent: boolean }> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, tenantId },
      relations: ['payments'],
    });
    if (!bill) throw new NotFoundException('Bill not found');

    const order = bill.orderId
      ? await this.orderRepo.findOne({ where: { id: bill.orderId }, relations: ['items'] })
      : null;
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
      billNumber:    bill.billNumber,
      issuedAt:      bill.issuedAt ?? new Date(),
      customerName:  bill.customerName  || 'Valued Customer',
      customerPhone: bill.customerPhone ?? undefined,
      branchName:    branch?.name       ?? 'Our Restaurant',
      branchAddress: branch?.addressLine1 ?? undefined,
      gstin:         (branch as any)?.gstin ?? undefined,
      items,
      payments,
      subtotal:   items.reduce((s, i) => s + i.total, 0),
      cgst:       Number(bill.cgstAmount),
      sgst:       Number(bill.sgstAmount),
      igst:       Number(bill.igstAmount),
      grandTotal: Number(bill.grandTotal),
    };

    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.pdf.generateInvoicePdf(invoiceData);
    } catch { /* PDF failure must never block email */ }

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

  /* ── Reprint ─────────────────────────────────────────────────────────── */
  async reprintBill(billId: string, tenantId: string): Promise<any> {
    const bill = await this.billRepo.findOne({
      where: { id: billId, tenantId },
      relations: ['payments'],
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot reprint a voided bill');
    }
    bill.printedCount = (bill.printedCount || 0) + 1;
    bill.printedAt    = new Date();
    await this.billRepo.save(bill);

    // Return full detail so frontend can print with all correct fields
    return this.getBill(billId, tenantId);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private buildGstSummary(items: OrderItem[], discountRatio = 0) {
    const scale  = 1 - discountRatio;
    const groups = new Map<number, {
      rate: number; taxable: number; cgst: number; sgst: number; igst: number;
    }>();

    for (const item of items) {
      const rate     = Number(item.gstRate);
      const existing = groups.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      existing.taxable += Number(item.taxableAmount) * scale;
      existing.cgst    += Number(item.cgstAmount)    * scale;
      existing.sgst    += Number(item.sgstAmount)    * scale;
      existing.igst    += Number(item.igstAmount)    * scale;
      groups.set(rate, existing);
    }

    return Array.from(groups.values()).map((g) => ({
      gstRate:       g.rate,
      taxableAmount: g.taxable.toFixed(2),
      cgstAmount:    g.cgst.toFixed(2),
      sgstAmount:    g.sgst.toFixed(2),
      igstAmount:    g.igst.toFixed(2),
      totalTax:      (g.cgst + g.sgst + g.igst).toFixed(2),
    }));
  }

  private async updateShiftTotals(
    shiftId: string,
    bill: Bill,
    payments: PaymentSplitDto[],
    em: any,
  ) {
    const shift = await em.findOne(Shift, { where: { id: shiftId } });
    if (!shift) return;

    shift.totalSales  = Number(shift.totalSales)  + Number(bill.grandTotal);
    shift.totalOrders = Number(shift.totalOrders) + 1;

    for (const p of payments) {
      switch (p.method) {
        case 'cash':          shift.cashSales     = Number(shift.cashSales)     + p.amount; break;
        case 'card':          shift.cardSales     = Number(shift.cardSales)     + p.amount; break;
        case 'upi':           shift.upiSales      = Number(shift.upiSales)      + p.amount; break;
        case 'wallet':        shift.walletSales   = Number(shift.walletSales)   + p.amount; break;
        case 'credit':        shift.creditSales   = Number(shift.creditSales)   + p.amount; break;
        case 'complimentary': shift.complimentary = Number(shift.complimentary) + p.amount; break;
      }
    }

    shift.totalCgst = Number(shift.totalCgst) + Number(bill.cgstAmount);
    shift.totalSgst = Number(shift.totalSgst) + Number(bill.sgstAmount);
    shift.totalIgst = Number(shift.totalIgst) + Number(bill.igstAmount);

    await em.save(shift);
  }

  private async generateBillNumber(
    tenantId: string,
    branchId: string,
    em: any,
  ): Promise<string> {
    const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `INV-${today}-`;

    const [{ lock_key }] = await em.query(
      `SELECT abs(hashtext($1))::bigint AS lock_key`,
      [`bill_seq:${tenantId}:${today}`],
    );
    await em.query(`SELECT pg_advisory_xact_lock($1)`, [lock_key]);

    const [{ count }] = await em.query(
      `SELECT COUNT(*)::int AS count FROM bills WHERE tenant_id = $1 AND bill_number LIKE $2`,
      [tenantId, `${prefix}%`],
    );

    return `${prefix}${String(Number(count) + 1).padStart(5, '0')}`;
  }

  // ─── Razorpay ────────────────────────────────────────────────────────────

  async createRazorpayOrderForBilling(
    tenantId: string,
    amountInRupees: number,
    receipt?: string,
  ): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const rzp = tenant.settings?.razorpay;
    if (!rzp?.keyId || !rzp?.keySecret) {
      throw new BadRequestException(
        'Razorpay is not configured. Please connect Razorpay in Settings.',
      );
    }

    const client      = new Razorpay({ key_id: rzp.keyId, key_secret: rzp.keySecret });
    const amountPaise = Math.round(amountInRupees * 100);

    try {
      const order = await client.orders.create({
        amount:   amountPaise,
        currency: 'INR',
        receipt:  receipt || `bill-${Date.now()}`,
      });
      this.logger.log(`Razorpay order created: ${order.id} for tenant ${tenantId}`);
      return { orderId: order.id, amount: amountPaise, currency: 'INR', keyId: rzp.keyId };
    } catch (e: any) {
      this.logger.error('Razorpay order creation failed', e?.error || e);
      throw new BadRequestException(
        e?.error?.description || 'Failed to create Razorpay order.',
      );
    }
  }

  async verifyRazorpayBillingPayment(
    tenantId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<{ valid: boolean; paymentId: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const keySecret = tenant.settings?.razorpay?.keySecret;
    if (!keySecret) throw new BadRequestException('Razorpay is not configured.');

    const body              = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      throw new BadRequestException('Invalid Razorpay signature. Payment could not be verified.');
    }

    return { valid: true, paymentId: razorpayPaymentId };
  }
}