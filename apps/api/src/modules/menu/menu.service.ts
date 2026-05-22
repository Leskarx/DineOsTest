import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { MenuItemVariation } from './entities/menu-item-variation.entity';
import { Category } from './entities/category.entity';
import { GstRate } from '../billing/entities/gst-rate.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem) private readonly itemRepo: Repository<MenuItem>,
    @InjectRepository(MenuItemVariation) private readonly variationRepo: Repository<MenuItemVariation>,
    @InjectRepository(Category) private readonly catRepo: Repository<Category>,
    @InjectRepository(GstRate) private readonly gstRepo: Repository<GstRate>,
  ) {}

  getCategories(tenantId: string, branchId?: string) {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    return this.catRepo.find({ where, order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  createCategory(data: Partial<Category>) { return this.catRepo.save(this.catRepo.create(data)); }

  getItems(tenantId: string, branchId?: string, categoryId?: string) {
    const where: any = { tenantId, isActive: true };
    if (branchId) where.branchId = branchId;
    if (categoryId) where.categoryId = categoryId;
    // Include active variations so the POS can show the picker immediately
    return this.itemRepo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: ['variations'],
    });
  }

  async getItem(id: string, tenantId: string) {
    const item = await this.itemRepo.findOne({ where: { id, tenantId }, relations: ['variations'] });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  createItem(data: Partial<MenuItem>) { return this.itemRepo.save(this.itemRepo.create(data)); }

  async updateItem(id: string, tenantId: string, data: Partial<MenuItem>) {
    await this.getItem(id, tenantId);
    await this.itemRepo.update(id, data);
    return this.getItem(id, tenantId);
  }

  removeItem(id: string) { return this.itemRepo.update(id, { isActive: false }); }

  // ── Variations ────────────────────────────────────────────────────────────

  async getVariations(menuItemId: string, tenantId: string) {
    await this.getItem(menuItemId, tenantId); // ownership check
    return this.variationRepo.find({
      where: { menuItemId, tenantId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async createVariation(menuItemId: string, tenantId: string, data: Partial<MenuItemVariation>) {
    await this.getItem(menuItemId, tenantId); // ownership check
    return this.variationRepo.save(
      this.variationRepo.create({ ...data, menuItemId, tenantId }),
    );
  }

  async updateVariation(id: string, tenantId: string, data: Partial<MenuItemVariation>) {
    const v = await this.variationRepo.findOne({ where: { id, tenantId } });
    if (!v) throw new NotFoundException('Variation not found');
    await this.variationRepo.update(id, data);
    return this.variationRepo.findOneOrFail({ where: { id } });
  }

  async removeVariation(id: string, tenantId: string) {
    const v = await this.variationRepo.findOne({ where: { id, tenantId } });
    if (!v) throw new NotFoundException('Variation not found');
    return this.variationRepo.update(id, { isActive: false });
  }

  getGstRates(tenantId: string) { return this.gstRepo.find({ where: { tenantId, isActive: true } }); }

  async seedDefaultGstRates(tenantId: string) {
    const defaults = [
      { name: 'Exempt', rate: 0, cgstRate: 0, sgstRate: 0, igstRate: 0, hsnSacCode: '9963' },
      { name: 'GST 5%', rate: 5, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5, hsnSacCode: '9963' },
      { name: 'GST 12%', rate: 12, cgstRate: 6, sgstRate: 6, igstRate: 12, hsnSacCode: '9963' },
      { name: 'GST 18%', rate: 18, cgstRate: 9, sgstRate: 9, igstRate: 18, hsnSacCode: '9963' },
      { name: 'GST 28%', rate: 28, cgstRate: 14, sgstRate: 14, igstRate: 28, hsnSacCode: '2203' },
    ];
    const rates = defaults.map((d) => this.gstRepo.create({ ...d, tenantId }));
    return this.gstRepo.save(rates);
  }
}
