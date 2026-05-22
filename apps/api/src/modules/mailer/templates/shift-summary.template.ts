import { baseLayout, formatCurrency, formatDate } from './base.template';

export function shiftSummaryTemplate(opts: {
  branchName: string;
  shiftNumber: string;
  openedBy: string;
  closedBy: string;
  openedAt: Date;
  closedAt: Date;
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  upiSales: number;
  openingCash: number;
  closingCash: number;
  expectedCash: number;
  cashDifference: number;
}): string {
  const diffColor = opts.cashDifference < 0 ? '#dc2626' : opts.cashDifference > 0 ? '#16a34a' : '#71717a';
  const diffLabel = opts.cashDifference < 0 ? `Short by ${formatCurrency(Math.abs(opts.cashDifference))}` :
    opts.cashDifference > 0 ? `Over by ${formatCurrency(opts.cashDifference)}` : 'Balanced ✓';

  const body = `
    <h2>Shift Summary — ${opts.shiftNumber}</h2>
    <p>Here is the end-of-shift report for <strong>${opts.branchName}</strong>.</p>

    <div class="card">
      <div class="row"><span class="label">Branch</span><span class="value">${opts.branchName}</span></div>
      <div class="row"><span class="label">Shift</span><span class="value">${opts.shiftNumber}</span></div>
      <div class="row"><span class="label">Opened by</span><span class="value">${opts.openedBy}</span></div>
      <div class="row"><span class="label">Closed by</span><span class="value">${opts.closedBy}</span></div>
      <div class="row"><span class="label">Start time</span><span class="value">${formatDate(opts.openedAt)}</span></div>
      <div class="row"><span class="label">End time</span><span class="value">${formatDate(opts.closedAt)}</span></div>
    </div>

    <h2>Sales</h2>
    <div class="card">
      <div class="row"><span class="label">Total orders</span><span class="value">${opts.totalOrders}</span></div>
      <div class="row total"><span class="label">Total sales</span><span class="value">${formatCurrency(opts.totalSales)}</span></div>
    </div>

    <h2>Payment Breakdown</h2>
    <div class="card">
      <div class="row"><span class="label">Cash</span><span class="value">${formatCurrency(opts.cashSales)}</span></div>
      <div class="row"><span class="label">Card</span><span class="value">${formatCurrency(opts.cardSales)}</span></div>
      <div class="row"><span class="label">UPI</span><span class="value">${formatCurrency(opts.upiSales)}</span></div>
    </div>

    <h2>Cash Reconciliation</h2>
    <div class="card">
      <div class="row"><span class="label">Opening cash</span><span class="value">${formatCurrency(opts.openingCash)}</span></div>
      <div class="row"><span class="label">Expected closing cash</span><span class="value">${formatCurrency(opts.expectedCash)}</span></div>
      <div class="row"><span class="label">Actual closing cash</span><span class="value">${formatCurrency(opts.closingCash)}</span></div>
      <div class="row"><span class="label">Difference</span><span class="value" style="color:${diffColor}">${diffLabel}</span></div>
    </div>
  `;
  return baseLayout(`Shift Summary — ${opts.shiftNumber}`, body);
}
