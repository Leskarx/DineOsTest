import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FEATURES_KEY } from '../../../common/decorators/roles.decorator';
import { Subscription, SubscriptionStatus } from '../../subscriptions/entities/subscription.entity';
import { Plan } from '../../subscriptions/entities/plan.entity';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const features = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!features?.length) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.tenantId) return false;

    const sub = await this.subRepo.findOne({
      where: { tenantId: user.tenantId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    if (!sub) throw new ForbiddenException('No active subscription');
    if (sub.status === SubscriptionStatus.CANCELLED) throw new ForbiddenException('Subscription cancelled');

    // Trial gets all features
    if (sub.status === SubscriptionStatus.TRIAL) return true;

    const planFeatures: string[] = sub.plan?.features || [];
    if (planFeatures.includes('all')) return true;

    const missing = features.filter((f) => !planFeatures.includes(f));
    if (missing.length) {
      throw new ForbiddenException(`Feature not available on your plan: ${missing.join(', ')}. Please upgrade.`);
    }

    return true;
  }
}
