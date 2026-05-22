export function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; color: #18181b; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .header { background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px 40px; }
    .header h1 { color: #fff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
    .header p { color: rgba(255,255,255,.8); font-size: 13px; margin-top: 4px; }
    .body { padding: 36px 40px; }
    .body p { font-size: 15px; line-height: 1.6; color: #3f3f46; margin-bottom: 16px; }
    .body h2 { font-size: 18px; font-weight: 600; color: #18181b; margin-bottom: 12px; }
    .btn { display: inline-block; background: #f97316; color: #fff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0 20px; }
    .card { background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; padding: 20px 24px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #71717a; }
    .row .value { font-weight: 600; color: #18181b; }
    .row.total .label, .row.total .value { font-size: 16px; font-weight: 700; color: #f97316; }
    table.items { width: 100%; border-collapse: collapse; font-size: 13px; margin: 16px 0; }
    table.items th { background: #f4f4f5; padding: 8px 12px; text-align: left; color: #52525b; font-weight: 600; }
    table.items td { padding: 8px 12px; border-bottom: 1px solid #f4f4f5; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #dcfce7; color: #16a34a; }
    .badge-orange { background: #fff7ed; color: #ea580c; }
    .badge-red { background: #fee2e2; color: #dc2626; }
    .footer { padding: 20px 40px; background: #fafafa; border-top: 1px solid #e4e4e7; text-align: center; font-size: 12px; color: #a1a1aa; }
    .footer a { color: #f97316; text-decoration: none; }
    @media (max-width: 640px) { .body, .header, .footer { padding-left: 20px; padding-right: 20px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Dine&amp;Stay OS</h1>
      <p>Restaurant &amp; Hospitality Management</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Dine&amp;Stay OS · <a href="https://dinestay.app">dinestay.app</a></p>
      <p style="margin-top:6px">You received this because you have an account with us.</p>
    </div>
  </div>
</body>
</html>`;
}

export function formatCurrency(amount: number): string {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
