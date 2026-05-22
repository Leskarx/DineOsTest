import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderItem, KdsStatus } from '../orders/entities/order-item.entity';

@Injectable()
export class KdsService {
  constructor(
    @InjectRepository(OrderItem) private readonly itemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Returns all pending/preparing/acknowledged KDS tickets for a branch.
   * Fields are aliased to match the KDS front-end expectations:
   * order_item_id, item_name, quantity, notes, kds_status, created_at,
   * order_order_number, order_type, table_name, category_name, age_seconds
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
        oi.menu_item_id,
        o.id                     AS order_id,
        o.order_number           AS order_order_number,
        o.order_type,
        t.table_number           AS table_name,
        c.name                   AS category_name,
        EXTRACT(EPOCH FROM (NOW() - oi.created_at))::INT AS age_seconds
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT  JOIN tables t ON t.id = o.table_id
      LEFT  JOIN menu_items mi ON mi.id = oi.menu_item_id
      LEFT  JOIN categories c  ON c.id = mi.category_id
      WHERE o.branch_id  = $1
        AND o.tenant_id  = $2
        AND oi.kds_status IN ('pending','acknowledged','preparing')
        AND oi.is_voided  = false
        AND o.status NOT IN ('cancelled','billed','void')
      ORDER BY oi.created_at ASC
    `, [branchId, tenantId]);
  }

  async updateItemStatus(itemId: string, status: KdsStatus, tenantId: string) {
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId },
      relations: ['order'],
    });
    if (!item) throw new NotFoundException('Order item not found');

    item.kdsStatus = status;
    if (status === KdsStatus.ACKNOWLEDGED) item.kdsAcknowledgedAt = new Date();
    if (status === KdsStatus.READY) item.kdsReadyAt = new Date();

    await this.itemRepo.save(item);

    this.events.emit('kds.itemStatus', {
      itemId,
      orderId: item.orderId,
      status,
      branchId: (item as any).order?.branchId,
    });

    return item;
  }

  async bumpItem(itemId: string, tenantId: string) {
    return this.updateItemStatus(itemId, KdsStatus.READY, tenantId);
  }

  async recallItem(itemId: string, tenantId: string) {
    return this.updateItemStatus(itemId, KdsStatus.PREPARING, tenantId);
  }
}
