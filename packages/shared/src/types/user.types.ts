export type UserRole = 'superadmin' | 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'inventory';

export interface User {
  id: string;
  tenantId: string;
  branchId?: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  employeeCode?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  gstin?: string;
  pan?: string;
  fssaiNo?: string;
  email: string;
  phone?: string;
  logoUrl?: string;
  state?: string;
  stateCode?: string;
}
