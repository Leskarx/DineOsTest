import { baseLayout } from './base.template';

export function passwordResetTemplate(opts: {
  name: string;
  resetLink: string;
  expiresIn: string;
}): string {
  const body = `
    <h2>Reset your password</h2>
    <p>Hi ${opts.name}, we received a request to reset the password for your Dine&amp;Stay OS account.</p>
    <p>Click the button below to set a new password. This link expires in <strong>${opts.expiresIn}</strong>.</p>

    <a class="btn" href="${opts.resetLink}">Reset Password →</a>

    <div class="card">
      <p style="font-size:13px;margin:0;color:#71717a">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not be changed.
      </p>
    </div>

    <p style="font-size:13px;color:#71717a">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${opts.resetLink}" style="color:#f97316;word-break:break-all">${opts.resetLink}</a>
    </p>
  `;
  return baseLayout('Reset your password — Dine&Stay OS', body);
}
