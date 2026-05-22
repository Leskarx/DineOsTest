import { baseLayout, formatDate } from './base.template';

export function welcomeTemplate(opts: {
  businessName: string;
  ownerName: string;
  trialEndsAt: Date;
}): string {
  const body = `
    <h2>Welcome aboard, ${opts.ownerName}! 🎉</h2>
    <p>Your <strong>${opts.businessName}</strong> account is ready. You have a full 14-day free trial — no credit card needed.</p>

    <div class="card">
      <div class="row"><span class="label">Business</span><span class="value">${opts.businessName}</span></div>
      <div class="row"><span class="label">Trial ends</span><span class="value">${formatDate(opts.trialEndsAt)}</span></div>
      <div class="row"><span class="label">Plan</span><span class="value"><span class="badge badge-green">Starter — Free Trial</span></span></div>
    </div>

    <h2>Get started in 3 steps</h2>
    <p><strong>1. Set up your menu</strong> — Add categories, items, and GST rates from the Menu section.</p>
    <p><strong>2. Configure your tables</strong> — Create sections and table layout under Tables.</p>
    <p><strong>3. Open your first shift</strong> — Head to Shifts and start taking orders!</p>

    <a class="btn" href="https://app.dinestay.app/login">Open Dine&amp;Stay OS →</a>

    <p style="font-size:13px;color:#71717a">Need help? Reply to this email or visit our <a href="https://docs.dinestay.app" style="color:#f97316">documentation</a>.</p>
  `;
  return baseLayout('Welcome to Dine&Stay OS', body);
}
