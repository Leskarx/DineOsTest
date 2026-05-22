export const PLAN_FEATURES = {
  starter: [
    'pos', 'billing', 'gst', 'kds', 'inventory', 'shifts',
    'reports_basic', 'thermal_print', 'offline_sync',
  ],
  growth: [
    'pos', 'billing', 'gst', 'kds', 'inventory', 'shifts',
    'reports_advanced', 'thermal_print', 'offline_sync',
    'multi_branch', 'hq_dashboard', 'inventory_advanced', 'employee_mgmt',
  ],
  enterprise: ['all'],
} as const;

export const PLAN_LIMITS = {
  starter:    { maxBranches: 1,  maxUsers: 10, maxMenuItems: 200,  priceMonthly: 2999, priceAnnual: 29990  },
  growth:     { maxBranches: 5,  maxUsers: 50, maxMenuItems: 1000, priceMonthly: 7999, priceAnnual: 79990  },
  enterprise: { maxBranches: -1, maxUsers: -1, maxMenuItems: -1,   priceMonthly: 0,    priceAnnual: 0      },
} as const;

export type PlanCode = keyof typeof PLAN_LIMITS;
export type FeatureKey = typeof PLAN_FEATURES[PlanCode][number];

export function hasFeature(planCode: PlanCode, feature: string): boolean {
  const features = PLAN_FEATURES[planCode] as readonly string[];
  return features.includes('all') || features.includes(feature);
}
