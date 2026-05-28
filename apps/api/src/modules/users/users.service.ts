import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findAll(tenantId: string, branchId?: string) {
    const select: (keyof import('./entities/user.entity').User)[] = [
      'id', 'firstName', 'lastName', 'email',
      'phone', 'role', 'employeeCode', 'branchId', 'createdAt',
    ];

    // Owners and managers are tenant-wide — they must always appear
    // regardless of which branch is being viewed. Branch-level staff
    // (cashier, waiter, kitchen, inventory) are scoped to their branch.
    if (branchId) {
      return this.repo.find({
        where: [
          // Branch-scoped staff for this specific branch
          { tenantId, isActive: true, branchId },
          // Tenant-wide roles visible across all branches
          { tenantId, isActive: true, role: 'owner' as any },
          { tenantId, isActive: true, role: 'manager' as any },
        ],
        select,
        order: { createdAt: 'DESC' },
      });
    }

    return this.repo.find({
      where: { tenantId, isActive: true },
      select,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const u = await this.repo.findOne({ where: { id, tenantId } });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async create(data: Partial<User> & { password: string }) {
    const existing = await this.repo.findOne({
      where: [
        { tenantId: data.tenantId, email: data.email },
        { tenantId: data.tenantId, phone: data.phone },
      ],
    });
    if (existing) throw new ConflictException('User already exists with this email/phone');

    const passwordHash = await bcrypt.hash(data.password, 12);
    // ✅ PIN is hashed with bcrypt — now fits in VARCHAR(72)
    const pin = data.pin ? await bcrypt.hash(String(data.pin), 10) : undefined;

    const user = this.repo.create({
      ...data,
      passwordHash,
      ...(pin !== undefined ? { pin } : {}),
    });
    await this.repo.save(user);

    const { passwordHash: _ph, refreshToken: _rt, pin: _pin, ...safe } = user as any;
    return safe;
  }

  async update(id: string, tenantId: string, data: Partial<User>) {
    await this.findOne(id, tenantId);
    const patch: Partial<User> = { ...data };
    if ((patch as any).pin) {
      (patch as any).pin = await bcrypt.hash(String((patch as any).pin), 10);
    }
    await this.repo.update(id, patch);
    return this.findOne(id, tenantId);
  }

  async deactivate(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    return this.repo.update(id, { isActive: false });
  }
}