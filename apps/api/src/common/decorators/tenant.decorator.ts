import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.user?.tenantId || req.tenantId;
});

export const BranchId = createParamDecorator((data: unknown, ctx: ExecutionContext): string | null => {
  const req = ctx.switchToHttp().getRequest();
  
  if (req.user?.role === 'owner') {
    const headerBranch = req.headers['x-branch-id'];
    if (headerBranch === 'all' || !headerBranch) return null;
    return headerBranch as string;
  }
  
  return req.user?.branchId || req.branchId || (req.headers['x-branch-id'] as string) || null;
});

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});
