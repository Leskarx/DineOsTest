import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItem, KdsStatus } from '../orders/entities/order-item.entity';

const KDS_BUMPED_MARKER = '__KDS_BUMPED__';

@Injectable()
export class KdsService {
  constructor(
    @InjectRepository(OrderItem)
    private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Show all KDS-visible items:
   * - pending
   * - acknowledged
   * - preparing
   * - ready (only if NOT bumped)
   */
  async getPendingItems(branchId: string, tenantId: string) {
    return this.dataSource.query(`
      SELECT
        oi.id                    AS order_item_id,
        oi.name                  AS item_name,
        oi.quantity,
        oi.notes,
        oi.kds_status,
        oi.created_at,
        oi.kds_ready_at,
        oi.menu_item_id,
        o.id                     AS order_id,
        o.order_number           AS order_order_number,
        o.order_type,
        t.table_number           AS table_name,
        c.name                   AS category_name,
        EXTRACT(EPOCH FROM (NOW() - oi.created_at))::INT AS age_seconds
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN tables t     ON t.id = o.table_id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT JOIN categories c  ON c.id = mi.category_id
      WHERE o.branch_id = $1
        AND o.tenant_id = $2
        AND oi.kds_status IN ('pending', 'acknowledged', 'preparing', 'ready')
        AND oi.is_voided = false
        AND COALESCE(oi.void_reason, '') <> $3
        AND o.status NOT IN ('cancelled', 'billed', 'void')
      ORDER BY oi.created_at DESC
    `, [branchId, tenantId, KDS_BUMPED_MARKER]);
  }

  /**
   * Normal status transitions:
   * - pending -> preparing
   * - preparing -> ready
   * - recall -> preparing
   *
   * Any normal status update clears the bumped marker.
   */
  async updateItemStatus(itemId: string, status: KdsStatus, tenantId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Order item not found');

    item.kdsStatus = status;

    // clear bump marker whenever item is actively re-opened / updated
    item.voidReason = null;

    if (status === KdsStatus.ACKNOWLEDGED || status === KdsStatus.PREPARING) {
      item.kdsAcknowledgedAt = item.kdsAcknowledgedAt || new Date();
    }

    if (status === KdsStatus.READY) {
      item.kdsReadyAt = new Date();
    }

    await this.itemRepo.save(item);

    this.events.emit('kds.itemStatus', {
      itemId,
      orderId: item.orderId,
      status,
      branchId: (item as any).order?.branchId,
    });

    return item;
  }

  /**
   * Bump = hide from KDS without changing DB enum.
   * We keep status as READY but add a hidden marker in void_reason.
   */
  async bumpItem(itemId: string, tenantId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Order item not found');

    item.kdsStatus = KdsStatus.READY;
    item.kdsReadyAt = item.kdsReadyAt || new Date();
    item.voidReason = KDS_BUMPED_MARKER;

    await this.itemRepo.save(item);

    this.events.emit('kds.itemStatus', {
      itemId,
      orderId: item.orderId,
      status: 'bumped',
      branchId: (item as any).order?.branchId,
    });

    return item;
  }

  /**
   * Recall = bring bumped/ready item back into kitchen flow.
   */
  async recallItem(itemId: string, tenantId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Order item not found');

    item.kdsStatus = KdsStatus.PREPARING;
    item.voidReason = null;

    await this.itemRepo.save(item);

    this.events.emit('kds.itemStatus', {
      itemId,
      orderId: item.orderId,
      status: KdsStatus.PREPARING,
      branchId: (item as any).order?.branchId,
    });

    return item;
  }
}