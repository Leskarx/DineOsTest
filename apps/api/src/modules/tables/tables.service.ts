import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table, TableStatus } from './entities/table.entity';
import { TableSection } from './entities/table-section.entity';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)        private readonly repo: Repository<Table>,
    @InjectRepository(TableSection) private readonly secRepo: Repository<TableSection>,
  ) {}

  // ── Tables ─────────────────────────────────────────────────────────────────

  findAll(branchId: string, tenantId: string) {
    return this.repo.find({
      where: { branchId, tenantId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const t = await this.repo.findOne({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Table not found');
    return t;
  }

  create(data: Partial<Table>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, tenantId: string, data: Partial<Table>) {
    await this.findOne(id, tenantId);
    await this.repo.update(id, data);
    return this.findOne(id, tenantId);
  }

  async updateStatus(id: string, status: TableStatus) {
    await this.repo.update(id, { status });
  }

  remove(id: string) {
    return this.repo.update(id, { isActive: false });
  }

  // ── Sections ───────────────────────────────────────────────────────────────

  findAllSections(branchId: string, tenantId: string) {
    return this.secRepo.find({
      where: { branchId, tenantId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOneSection(id: string, tenantId: string) {
    const s = await this.secRepo.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Section not found');
    return s;
  }

  createSection(data: Partial<TableSection>) {
    return this.secRepo.save(this.secRepo.create(data));
  }

  async updateSection(id: string, tenantId: string, data: Partial<TableSection>) {
    await this.findOneSection(id, tenantId);
    await this.secRepo.update(id, data);
    return this.findOneSection(id, tenantId);
  }

  async removeSection(id: string, tenantId: string) {
    // Guard — don't delete if tables are assigned
    const tableCount = await this.repo.count({ where: { sectionId: id, tenantId, isActive: true } });
    if (tableCount > 0) {
      throw new BadRequestException(
        `Move or reassign ${tableCount} table(s) before deleting this section.`,
      );
    }
    await this.secRepo.update(id, { isActive: false });
    return { success: true };
  }
}
