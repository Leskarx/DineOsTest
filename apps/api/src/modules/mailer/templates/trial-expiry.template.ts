import { baseLayout, formatDate } from './base.template';

export function trialExpiryTemplate(opts: {
  businessName: string;
  trialEndsAt: Date;
  upgradeLink: string;
}): string {
  const body = `
    <h2>Your trial ends soon ⏰</h2>
    <p>Hi, your Dine&amp;Stay OS trial for <strong>${opts.businessName}</strong> expires on <strong>${formatDate(opts.trialEndsAt)}</strong>.</p>
    <p>Upgrade now to keep your data, staff accounts, and billing history — and continue running your restaurant without interruption.</p>

    <a class="btn" href="${opts.upgradeLink}">Upgrade Now →</a>

    <div class="card">
      <p style="font-size:13px;margin:0;color:#52525b">
        <strong>What happens after trial ends?</strong><br/>
        Your account will be locked for new orders. All your data is safely preserved for 30 days while you choose a plan.
      </p>
    </div>

    <p style="font-size:13px;color:#71717a">
      Questions? Reply to this email — we're happy to help you find the right plan.
    </p>
  `;
  return baseLayout('Your trial is ending — Dine&Stay OS', body);
}
