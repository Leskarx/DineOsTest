import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(@InjectRepository(Branch) private readonly repo: Repository<Branch>) {}
  findAll(tenantId: string) { return this.repo.find({ where: { tenantId, isActive: true }, order: { name: 'ASC' } }); }
  async findOne(id: string, tenantId: string) {
    const b = await this.repo.findOne({ where: { id, tenantId } });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }
  create(data: Partial<Branch>) { return this.repo.save(this.repo.create(data)); }
  async update(id: string, tenantId: string, data: Partial<Branch>) {
    await this.findOne(id, tenantId);
    await this.repo.update(id, data);
    return this.findOne(id, tenantId);
  }
}
