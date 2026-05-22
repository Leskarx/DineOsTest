import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription, SubscriptionStatus } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
  ) {}

  getPlans() { return this.planRepo.find({ where: { isActive: true }, order: { priceMonthly: 'ASC' } }); }

  async getSubscription(tenantId: string) {
    const sub = await this.subRepo.findOne({ where: { tenantId }, relations: ['plan'], order: { createdAt: 'DESC' } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    const sub = await this.subRepo.findOne({ where: { tenantId }, relations: ['plan'] });
    if (!sub || sub.status === SubscriptionStatus.CANCELLED) return false;
    if (sub.status === SubscriptionStatus.TRIAL) return true;
    const features: string[] = sub.plan?.features || [];
    return features.includes('all') || features.includes(feature);
  }

  async checkLimits(tenantId: string) {
    const sub = await this.subRepo.findOne({ where: { tenantId }, relations: ['plan'] });
    if (!sub) return null;
    return {
      maxBranches: sub.plan?.maxBranches ?? 1,
      maxUsers: sub.plan?.maxUsers ?? 5,
      maxMenuItems: sub.plan?.maxMenuItems ?? 100,
      status: sub.status,
      trialEndsAt: sub.trialEndsAt,
    };
  }
}
