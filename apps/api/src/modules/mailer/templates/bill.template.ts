import { baseLayout, formatCurrency, formatDate } from './base.template';

export function billTemplate(opts: {
  customerName: string;
  billNumber: string;
  grandTotal: number;
  branchName: string;
  items: Array<{ name: string; qty: number; rate: number; total: number }>;
  payments: Array<{ method: string; amount: number }>;
  cgst: number;
  sgst: number;
  igst: number;
  issuedAt: Date;
}): string {
  const itemRows = opts.items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">${formatCurrency(i.rate)}</td>
      <td style="text-align:right">${formatCurrency(i.total)}</td>
    </tr>
  `).join('');

  const paymentRows = opts.payments.map(p => `
    <div class="row">
      <span class="label">${p.method.toUpperCase()}</span>
      <span class="value">${formatCurrency(p.amount)}</span>
    </div>
  `).join('');

  const totalTax = Number(opts.cgst) + Number(opts.sgst) + Number(opts.igst);
  const subtotal = Number(opts.grandTotal) - totalTax;

  const body = `
    <h2>Thank you, ${opts.customerName}!</h2>
    <p>Here is your bill from <strong>${opts.branchName}</strong>.</p>

    <div class="card">
      <div class="row"><span class="label">Bill No.</span><span class="value">${opts.billNumber}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${formatDate(opts.issuedAt)}</span></div>
      <div class="row"><span class="label">Branch</span><span class="value">${opts.branchName}</span></div>
    </div>

    <h2>Items</h2>
    <table class="items">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="card">
      <div class="row"><span class="label">Subtotal</span><span class="value">${formatCurrency(subtotal)}</span></div>
      ${opts.cgst > 0 ? `<div class="row"><span class="label">CGST</span><span class="value">${formatCurrency(opts.cgst)}</span></div>` : ''}
      ${opts.sgst > 0 ? `<div class="row"><span class="label">SGST</span><span class="value">${formatCurrency(opts.sgst)}</span></div>` : ''}
      ${opts.igst > 0 ? `<div class="row"><span class="label">IGST</span><span class="value">${formatCurrency(opts.igst)}</span></div>` : ''}
      <div class="row total"><span class="label">Grand Total</span><span class="value">${formatCurrency(opts.grandTotal)}</span></div>
    </div>

    <h2>Payment</h2>
    <div class="card">${paymentRows}</div>

    <p style="font-size:13px;color:#71717a">We hope to see you again soon! For any queries, please contact the restaurant directly.</p>
  `;
  return baseLayout(`Your bill — ${opts.billNumber}`, body);
}
