import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { MenuItemVariation } from '../menu/entities/menu-item-variation.entity';
import { GstRate } from '../billing/entities/gst-rate.entity';
import { Table } from '../tables/entities/table.entity';

export interface AddItemDto {
  menuItemId: string;
  quantity: number;
  notes?: string;
  variationId?: string;
  modifiers?: { modifierId: string; name: string; price: number }[];
}

export interface CreateOrderDto {
  branchId: string;
  tenantId: string;
  tableId?: string;
  type?: OrderType;
  covers?: number;
  customerName?: string;
  customerPhone?: string;
  items?: AddItemDto[];
  waiterId?: string;
  offlineId?: string;
  isComplimentary?: boolean;
  isSalesReturn?: boolean;
  scheduledAt?: Date;
  isOfflineSync?: boolean; // suppress KDS events when replaying an offline order
}

export interface ApplyDiscountDto {
  discountPercent?: number;
  discountAmount?: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    @InjectRepository(MenuItemVariation)
    private readonly variationRepo: Repository<MenuItemVariation>,
    @InjectRepository(GstRate)
    private readonly gstRepo: Repository<GstRate>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    let createdOrderId!: string;

    await this.dataSource.transaction(async (em) => {
      const orderNumber = await this.generateOrderNumberTx(dto.branchId, em);
      const order = em.create(Order, {
        tenantId:        dto.tenantId,
        branchId:        dto.branchId,
        tableId:         dto.tableId,
        orderNumber,
        type:            dto.type || OrderType.DINE_IN,
        covers:          dto.covers || 1,
        customerName:    dto.customerName,
        customerPhone:   dto.customerPhone,
        waiterId:        dto.waiterId,
        status:          OrderStatus.PLACED,
        placedAt:        new Date(),
        offlineId:       dto.offlineId,
        isComplimentary: dto.isComplimentary ?? false,
        isSalesReturn:   dto.isSalesReturn ?? false,
        scheduledAt:     dto.scheduledAt ?? null,
      });
      const saved = await em.save(order);
      createdOrderId = saved.id;

      if (dto.tableId) {
        await em.update(Table, dto.tableId, { status: 'occupied' as any });
      }
    });

    if (dto.items?.length) {
      await this.addItems(createdOrderId, dto.items, dto.tenantId, dto.isOfflineSync);
    }

    const saved = await this.findOne(createdOrderId, dto.tenantId);
    // Don't ring the KDS for orders that were already served offline
    if (!dto.isOfflineSync) {
      this.events.emit('order.created', saved);
    }
    return saved;
  }

  async addItems(orderId: string, items: AddItemDto[], tenantId: string, isOfflineSync = false): Promise<Order> {
    const order = await this.findOne(orderId, tenantId);
    if ([OrderStatus.BILLED, OrderStatus.CANCELLED].includes(order.status)) {
      throw new BadRequestException('Cannot modify a billed or cancelled order');
    }

    const menuItems = await this.menuRepo.findBy({
      id: In(items.map((i) => i.menuItemId)),
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    const variationIds = items.map((i) => i.variationId).filter(Boolean) as string[];
    const variations = variationIds.length
      ? await this.variationRepo.findBy({ id: In(variationIds) })
      : [];
    const varMap = new Map(variations.map((v) => [v.id, v]));

    const gstRateIds = [...new Set(menuItems.map((m) => m.gstRateId).filter(Boolean))];
    const gstRates = gstRateIds.length
      ? await this.gstRepo.findBy({ id: In(gstRateIds) })
      : [];
    const gstMap = new Map(gstRates.map((g) => [g.id, g]));

    const orderItems: OrderItem[] = [];
    for (const item of items) {
      const menu = menuMap.get(item.menuItemId);
      if (!menu) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);

      const gst = menu.gstRateId ? gstMap.get(menu.gstRateId) : null;
      const variation = item.variationId ? varMap.get(item.variationId) : null;
      const unitPrice = Number(variation?.price ?? menu.price);
      const modifierTotal = (item.modifiers || []).reduce((s, m) => s + Number(m.price), 0);
      const effectivePrice = unitPrice + modifierTotal;
      const lineSubtotal = effectivePrice * item.quantity;

      // ← Use intra-state by default (CGST + SGST only, no IGST)
      const { cgstAmt, sgstAmt, igstAmt, cessAmt } = this.computeTax(lineSubtotal, gst ?? null, false);

      orderItems.push(
        this.orderItemRepo.create({
          orderId,
          tenantId,
          menuItemId:    item.menuItemId,
          variationId:   variation?.id ?? null,
          variationName: variation?.name ?? null,
          name:          menu.name,
          sku:           menu.sku,
          quantity:      item.quantity,
          unitPrice:     effectivePrice,
          costPrice:     Number(variation?.costPrice ?? menu.costPrice ?? 0),
          isVeg:         menu.isVeg,
          notes:         item.notes,
          gstRate:       gst?.rate ?? 0,
          cgstRate:      gst?.cgstRate ?? 0,
          sgstRate:      gst?.sgstRate ?? 0,
          igstRate:      gst?.igstRate ?? 0,
          taxableAmount: lineSubtotal,
          cgstAmount:    cgstAmt,
          sgstAmount:    sgstAmt,
          igstAmount:    igstAmt,
          cessAmount:    cessAmt,
          lineTotal:     lineSubtotal + cgstAmt + sgstAmt + igstAmt + cessAmt,
        }),
      );
    }

    await this.orderItemRepo.save(orderItems);
    const updated = await this.recalculateTotals(orderId);
    if (!isOfflineSync) {
      this.events.emit('order.itemsAdded', {
        orderId,
        branchId:    updated.branchId,
        orderNumber: updated.orderNumber,
        items:       orderItems,
      });
    }
    return updated;
  }

  async updateStatus(orderId: string, status: OrderStatus, tenantId: string): Promise<Order> {
    const order = await this.findOne(orderId, tenantId);
    order.status = status;
    if (status === OrderStatus.PLACED)  order.placedAt = new Date();
    if (status === OrderStatus.SERVED)  order.servedAt = new Date();
    if (status === OrderStatus.BILLED)  order.billedAt = new Date();
    await this.orderRepo.save(order);
    this.events.emit('order.statusChanged', { orderId, status, branchId: order.branchId });
    return order;
  }

  async applyDiscount(orderId: string, dto: ApplyDiscountDto, tenantId: string): Promise<Order> {
    const order = await this.findOne(orderId, tenantId);
    if (dto.discountPercent !== undefined) order.discountPercent = dto.discountPercent;
    if (dto.discountAmount !== undefined)  order.discountAmount  = dto.discountAmount;
    await this.orderRepo.save(order);
    return this.recalculateTotals(orderId);
  }

  async voidItem(orderItemId: string, reason: string, tenantId: string) {
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId, tenantId } });
    if (!item) throw new NotFoundException('Order item not found');
    item.isVoided   = true;
    item.voidReason = reason;
    await this.orderItemRepo.save(item);
    return this.recalculateTotals(item.orderId);
  }

  async findAll(branchId: string, tenantId: string, status?: string, limit = 100) {
    const where: any = { branchId, tenantId };
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()) as OrderStatus[];
      where.status = statuses.length === 1 ? statuses[0] : In(statuses);
    }
    return this.orderRepo.find({
      where,
      relations: ['items', 'table'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string, tenantId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id, tenantId },
      relations: ['items', 'table'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async recalculateTotals(orderId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    const activeItems = order.items.filter((i) => !i.isVoided);

    const subtotal = activeItems.reduce(
      (s, i) => s + Number(i.unitPrice) * Number(i.quantity), 0,
    );

    const discountAmt = Number(order.discountPercent) > 0
      ? subtotal * (Number(order.discountPercent) / 100)
      : Number(order.discountAmount);

    const discountRatio = subtotal > 0 ? discountAmt / subtotal : 0;

    const taxable = subtotal - discountAmt;
    const cgst     = activeItems.reduce((s, i) => s + Number(i.cgstAmount), 0) * (1 - discountRatio);
    const sgst     = activeItems.reduce((s, i) => s + Number(i.sgstAmount), 0) * (1 - discountRatio);
    const igst     = activeItems.reduce((s, i) => s + Number(i.igstAmount), 0) * (1 - discountRatio);
    const cess     = activeItems.reduce((s, i) => s + Number(i.cessAmount), 0) * (1 - discountRatio);
    const totalTax = cgst + sgst + igst + cess;
    const rawTotal = taxable + totalTax;
    const roundOff = Math.round(rawTotal) - rawTotal;

    order.subtotal       = subtotal.toFixed(2) as any;
    order.discountAmount = discountAmt.toFixed(2) as any;
    order.taxableAmount  = taxable.toFixed(2) as any;
    order.cgstAmount     = cgst.toFixed(2) as any;
    order.sgstAmount     = sgst.toFixed(2) as any;
    order.igstAmount     = igst.toFixed(2) as any;
    order.cessAmount     = cess.toFixed(2) as any;
    order.totalTax       = totalTax.toFixed(2) as any;
    order.roundOff       = roundOff.toFixed(2) as any;
    order.grandTotal     = (rawTotal + roundOff).toFixed(2) as any;

    return this.orderRepo.save(order);
  }

  /**
   * Computes tax for a line item.
   *
   * CRITICAL: For intra-state (same state) sales → CGST + SGST only
   *           For inter-state sales → IGST only
   *           NEVER both at the same time
   *
   * @param amount     Taxable amount (price × qty)
   * @param gst        GST rate entity
   * @param isInterState  Whether customer is in a different state
   */
  private computeTax(
    amount: number,
    gst: GstRate | null,
    isInterState = false,
  ) {
    if (!gst) return { cgstAmt: 0, sgstAmt: 0, igstAmt: 0, cessAmt: 0 };

    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (isInterState) {
      // Inter-state: IGST only (equals full GST rate)
      igstAmt = amount * (Number(gst.igstRate || 0) / 100);
    } else {
      // Intra-state: CGST + SGST only (each is half of total rate)
      cgstAmt = amount * (Number(gst.cgstRate || 0) / 100);
      sgstAmt = amount * (Number(gst.sgstRate || 0) / 100);
    }

    const cessAmt = amount * (Number(gst.cessRate || 0) / 100);

    return {
      cgstAmt: parseFloat(cgstAmt.toFixed(2)),
      sgstAmt: parseFloat(sgstAmt.toFixed(2)),
      igstAmt: parseFloat(igstAmt.toFixed(2)),
      cessAmt: parseFloat(cessAmt.toFixed(2)),
    };
  }

  @OnEvent('kds.itemStatus')
  async handleKdsItemStatus(payload: {
    itemId: string;
    orderId: string;
    status: string;
    branchId: string;
  }) {
    const order = await this.orderRepo.findOne({
      where: { id: payload.orderId },
      relations: ['items'],
    });
    if (!order) return;

    const activeItems = order.items.filter((i) => !i.isVoided);
    if (activeItems.length === 0) return;

    if (['billed', 'cancelled', 'void'].includes(order.status)) return;

    const allCompleted        = activeItems.every((i) => i.kdsStatus === 'completed');
    const allReadyOrCompleted = activeItems.every((i) => ['ready', 'completed'].includes(i.kdsStatus as any));
    const anyPreparing        = activeItems.some((i) => i.kdsStatus === 'preparing');
    const anyReady            = activeItems.some((i) => i.kdsStatus === 'ready');
    const anyCompleted        = activeItems.some((i) => i.kdsStatus === 'completed');

    let newStatus = order.status;

    if (allCompleted) {
      newStatus = OrderStatus.SERVED;
    } else if (allReadyOrCompleted) {
      newStatus = OrderStatus.READY;
    } else if (anyPreparing || anyReady || anyCompleted) {
      newStatus = OrderStatus.PREPARING;
    }

    if (newStatus !== order.status) {
      order.status = newStatus;
      if (newStatus === OrderStatus.SERVED) order.servedAt = new Date();
      await this.orderRepo.save(order);
      this.events.emit('order.statusChanged', {
        orderId: order.id,
        status: newStatus,
        branchId: order.branchId,
      });
    }
  }

  private async generateOrderNumberTx(branchId: string, em: any): Promise<string> {
    const today  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${today}-`;

    const [{ lock_key }] = await em.query(
      `SELECT abs(hashtext($1))::bigint AS lock_key`,
      [`order_seq:${branchId}`],
    );
    await em.query(`SELECT pg_advisory_xact_lock($1)`, [lock_key]);

    const [{ count }] = await em.query(
      `SELECT COUNT(*)::int AS count FROM orders WHERE branch_id = $1 AND order_number LIKE $2`,
      [branchId, `${prefix}%`],
    );
    return `${prefix}${String(Number(count) + 1).padStart(4, '0')}`;
  }
}