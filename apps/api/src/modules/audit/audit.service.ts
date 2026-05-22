import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogDto {
  tenantId?: string;
  branchId?: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface AuditQueryParams {
  limit?: number;
  page?: number;
  entity?: string;
  action?: string;
  userId?: string;
  from?: string;   // ISO date string
  to?: string;     // ISO date string
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async log(dto: AuditLogDto): Promise<void> {
    try {
      const entry = this.auditRepo.create({
        ...dto,
        metadata: dto.metadata || {},
      });
      await this.auditRepo.save(entry);
    } catch {
      // Audit logging must never throw — swallow errors silently
    }
  }

  async findByEntity(entity: string, entityId: string, tenantId: string) {
    return this.auditRepo.find({
      where: { entity, entityId, tenantId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findByTenant(tenantId: string, params: AuditQueryParams = {}) {
    const { limit = 100, page = 1, entity, action, userId, from, to } = params;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = { tenantId };

    if (entity) where.entity = entity;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      const start = from ? new Date(from) : new Date(0);
      const end   = to   ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date();
      where.createdAt = Between(start, end);
    }

    const [data, total] = await this.auditRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return { data, total, page, limit };
  }

  async findByUser(userId: string, tenantId: string, limit = 50) {
    return this.auditRepo.find({
      where: { userId, tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
