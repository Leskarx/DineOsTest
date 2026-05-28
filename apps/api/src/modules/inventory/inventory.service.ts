import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryTransaction, TransactionType } from './entities/inventory-transaction.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
    @InjectRepository(InventoryTransaction)
    private readonly txnRepo: Repository<InventoryTransaction>,
    private readonly db: DataSource,
  ) {}

  getItems(tenantId: string, branchId?: string) {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    return this.itemRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getItem(id: string, tenantId: string) {
    const item = await this.itemRepo.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  createItem(data: Partial<InventoryItem>) {
    return this.itemRepo.save(this.itemRepo.create(data));
  }

  async updateItem(id: string, tenantId: string, data: Partial<InventoryItem>) {
    await this.getItem(id, tenantId);
    await this.itemRepo.update(id, data);
    return this.getItem(id, tenantId);
  }

  async recordTransaction(
    tenantId: string,
    branchId: string,
    itemId: string,
    type: TransactionType,
    quantity: number,
    unitCost = 0,
    notes?: string,
    createdBy?: string,
  ) {
    return this.db.transaction(async (em) => {
      // ← FIXED: use avg_cost (actual DB column name), not average_cost
      const [row] = await em.query(
        `SELECT id, current_stock, avg_cost, cost_price
         FROM inventory_items
         WHERE id = $1 AND tenant_id = $2
         FOR UPDATE`,
        [itemId, tenantId],
      );

      if (!row) throw new NotFoundException('Item not found');

      const currentStock = Number(row.current_stock);
      const isOutgoing   = [TransactionType.SALE, TransactionType.WASTE].includes(type);
      const newStock     = parseFloat(
        (currentStock + (isOutgoing ? -quantity : quantity)).toFixed(3),
      );

      if (isOutgoing && newStock < 0) {
        throw new BadRequestException(
          `Insufficient stock. Available: ${currentStock}`,
        );
      }

      // ← FIXED: read avg_cost (actual DB column name)
      let newAvgCost   = Number(row.avg_cost);
      let newCostPrice = Number(row.cost_price);

      if (type === TransactionType.PURCHASE && unitCost > 0) {
        const totalStock = currentStock + quantity;
        newAvgCost = parseFloat(
          ((newAvgCost * currentStock + unitCost * quantity) / totalStock).toFixed(4),
        );
        newCostPrice = unitCost;
      }

      // ← FIXED: SET avg_cost (actual DB column name), not average_cost
      await em.query(
        `UPDATE inventory_items
         SET current_stock = $1, avg_cost = $2, cost_price = $3, updated_at = NOW()
         WHERE id = $4`,
        [newStock, newAvgCost, newCostPrice, itemId],
      );

      return em.save(
        em.create(InventoryTransaction, {
          tenantId,
          branchId,
          inventoryItemId: itemId,
          type,
          quantity,
          unitCost,
          totalCost: quantity * unitCost,
          balanceAfter: newStock,
          notes,
          createdBy,
        }),
      );
    });
  }

  getLedger(itemId: string, tenantId: string, limit = 50) {
    return this.txnRepo.find({
      where: { inventoryItemId: itemId, tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  getLowStockAlerts(tenantId: string, branchId?: string) {
    return this.db.query(
      `SELECT * FROM v_stock_summary
       WHERE tenant_id = $1
       ${branchId ? 'AND branch_id = $2' : ''}
       AND stock_status IN ('low_stock', 'out_of_stock', 'reorder')
       ORDER BY current_stock ASC`,
      branchId ? [tenantId, branchId] : [tenantId],
    );
  }
}