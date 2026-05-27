/**
 * ESC/POS Thermal Printer Utility
 * Supports 58mm and 80mm printers via Web Serial API or raw print
 */

export type PrinterWidth = 58 | 80;

// ESC/POS command bytes
const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON: [ESC, 0x21, 0x10],
  DOUBLE_HEIGHT_OFF: [ESC, 0x21, 0x00],
  FONT_SMALL: [ESC, 0x4d, 0x01],
  FONT_NORMAL: [ESC, 0x4d, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  CUT: [GS, 0x56, 0x42, 0x00],
  FEED_LINE: [0x0a],
  BEEP: [ESC, 0x42, 0x03, 0x02],
};

class EscPosBuilder {
  private buffer: number[] = [];
  private cols: number;

  constructor(width: PrinterWidth = 80) {
    this.cols = width === 58 ? 32 : 48;
    this.cmd(CMD.INIT);
  }

  cmd(bytes: number[]) { this.buffer.push(...bytes); return this; }
  private text(str: string) {
    for (const ch of str) this.buffer.push(ch.charCodeAt(0));
    return this;
  }

  alignLeft() { return this.cmd(CMD.ALIGN_LEFT); }
  alignCenter() { return this.cmd(CMD.ALIGN_CENTER); }
  alignRight() { return this.cmd(CMD.ALIGN_RIGHT); }
  boldOn() { return this.cmd(CMD.BOLD_ON); }
  boldOff() { return this.cmd(CMD.BOLD_OFF); }
  feed(n = 1) { for (let i = 0; i < n; i++) this.cmd(CMD.FEED_LINE); return this; }
  cut() { return this.feed(4).cmd(CMD.CUT); }
  underlineOn() { return this.cmd(CMD.UNDERLINE_ON); }
  underlineOff() { return this.cmd(CMD.UNDERLINE_OFF); }

  line(str: string) { return this.text(str).cmd(CMD.FEED_LINE); }

  divider(char = '-') {
    return this.line(char.repeat(this.cols));
  }

  twoCol(left: string, right: string) {
    const pad = this.cols - left.length - right.length;
    return this.line(left + ' '.repeat(Math.max(1, pad)) + right);
  }

  threeCol(left: string, mid: string, right: string) {
    const remaining = this.cols - left.length - right.length;
    const padL = Math.floor((remaining - mid.length) / 2);
    const padR = remaining - mid.length - padL;
    return this.line(left + ' '.repeat(padL) + mid + ' '.repeat(padR) + right);
  }

  build(): Uint8Array { return new Uint8Array(this.buffer); }
}

export interface ReceiptData {
  restaurantName: string;
  address?: string;
  gstin?: string;
  fssaiNo?: string;
  phone?: string;
  billNumber: string;
  invoiceDate: string;
  cashierName?: string;
  tableName?: string;
  orderType: string;
  covers?: number;
  customerName?: string;
  customerGstin?: string;
  items: Array<{
    name: string;
    qty: number;
    rate: number;
    amount: number;
    gstRate?: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  gstSummary?: Array<{
    gstRate: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
  }>;
  totalTax: number;
  roundOff?: number;
  grandTotal: number;
  payments: Array<{ method: string; amount: number }>;
  changeAmount?: number;
  thankYouMessage?: string;
  width?: PrinterWidth;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  const p = new EscPosBuilder(data.width || 80);
  const fmt = (n: number) => `Rs.${n.toFixed(2)}`;

  p.alignCenter().boldOn().line(data.restaurantName.toUpperCase()).boldOff();
  if (data.address) p.alignCenter().line(data.address);
  if (data.phone) p.alignCenter().line(`Ph: ${data.phone}`);
  if (data.gstin) p.alignCenter().line(`GSTIN: ${data.gstin}`);
  if (data.fssaiNo) p.alignCenter().line(`FSSAI: ${data.fssaiNo}`);

  p.alignCenter().boldOn().line('TAX INVOICE').boldOff();
  p.divider();

  p.alignLeft();
  p.twoCol(`Bill No: ${data.billNumber}`, data.invoiceDate);
  if (data.tableName) p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
  if (data.orderType !== 'dine_in') p.line(`Type: ${data.orderType.replace('_', ' ').toUpperCase()}`);
  if (data.customerName) p.line(`Customer: ${data.customerName}`);
  if (data.customerGstin) p.line(`Cust GSTIN: ${data.customerGstin}`);
  if (data.cashierName) p.line(`Cashier: ${data.cashierName}`);

  p.divider();
  p.boldOn().threeCol('Item', 'Qty', 'Amt').boldOff();
  p.divider('-');

  for (const item of data.items) {
    const shortName = item.name.slice(0, 20);
    p.threeCol(shortName, `${item.qty}x${fmt(item.rate)}`, fmt(item.amount));
  }

  p.divider();
  p.twoCol('Subtotal', fmt(data.subtotal));
  if (data.discountAmount && data.discountAmount > 0) {
    p.twoCol('Discount', `-${fmt(data.discountAmount)}`);
  }

  if (data.gstSummary?.length) {
    p.divider('-');
    p.boldOn().line('GST Details').boldOff();
    for (const row of data.gstSummary) {
      p.twoCol(`Taxable @${row.gstRate}%`, fmt(row.taxableAmount));
      if (row.cgstAmount > 0) {
        p.twoCol(`  CGST @${row.gstRate / 2}%`, fmt(row.cgstAmount));
        p.twoCol(`  SGST @${row.gstRate / 2}%`, fmt(row.sgstAmount));
      } else if (row.igstAmount > 0) {
        p.twoCol(`  IGST @${row.gstRate}%`, fmt(row.igstAmount));
      }
    }
    p.divider('-');
    p.twoCol('Total GST', fmt(data.totalTax));
  } else {
    p.twoCol('GST', fmt(data.totalTax));
  }

  if (data.roundOff && data.roundOff !== 0) {
    p.twoCol('Round Off', fmt(data.roundOff));
  }

  p.divider('=');
  p.boldOn().twoCol('GRAND TOTAL', fmt(data.grandTotal)).boldOff();
  p.divider('=');

  p.boldOn().line('Payment').boldOff();
  for (const pay of data.payments) {
    p.twoCol(`  ${pay.method.toUpperCase()}`, fmt(pay.amount));
  }
  if (data.changeAmount && data.changeAmount > 0) {
    p.twoCol('Change', fmt(data.changeAmount));
  }

  p.divider();
  p.alignCenter();
  if (data.gstin) p.line('This is a Computer Generated Invoice');
  p.line(data.thankYouMessage || 'Thank you for dining with us!');
  p.line('Visit again :)');
  p.cut();

  return p.build();
}

/** Print via Web Serial API (Chrome 89+) */
export async function printSerial(data: ReceiptData): Promise<void> {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial API not supported. Use Chrome 89+ or a compatible browser.');
  }

  const bytes = buildReceipt(data);
  const port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate: 9600 });

  const writer = port.writable.getWriter();
  await writer.write(bytes);
  writer.releaseLock();
  await port.close();
}

/**
 * Print via hidden iframe — avoids popup blockers entirely.
 * Falls back to window.open if iframe method fails.
 */
export function printHtml(data: ReceiptData): void {
  const html = buildReceiptHtml(data);

  // Method 1: Hidden iframe (no popup blocker issues)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Cannot access iframe document');

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    // Wait for content to render before printing
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (printErr) {
        console.error('Iframe print failed, trying popup:', printErr);
        printViaPopup(html);
      }

      // Clean up iframe after printing
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch { /* already removed */ }
      }, 2000);
    }, 300);

    return;
  } catch (iframeErr) {
    console.warn('Iframe method failed, falling back to popup:', iframeErr);
  }

  // Method 2: Popup window (fallback)
  printViaPopup(html);
}

function printViaPopup(html: string): void {
  const win = window.open('', '_blank', 'width=400,height=700');
  if (!win) {
    // Last resort: open in same tab
    console.error('Popup blocked. Attempting same-tab print.');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }

  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    setTimeout(() => win.close(), 1000);
  }, 500);
}

function buildReceiptHtml(data: ReceiptData): string {
  const width = data.width === 58 ? '58mm' : '80mm';
  const fmt = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

  const itemRows = data.items
    .map((i) => `<tr><td>${i.name}</td><td class="c">${i.qty}×${fmt(i.rate)}</td><td class="r">${fmt(i.amount)}</td></tr>`)
    .join('');

  const gstRows = (data.gstSummary || [])
    .map((g) => {
      const taxable = Number(g.taxableAmount || 0);
      const cgst    = Number(g.cgstAmount || 0);
      const sgst    = Number(g.sgstAmount || 0);
      const igst    = Number(g.igstAmount || 0);
      const rate    = Number(g.gstRate || 0);

      let rows = `<tr><td>Taxable @${rate}%</td><td></td><td class="r">${fmt(taxable)}</td></tr>`;
      if (cgst > 0) {
        rows += `<tr><td>&nbsp;&nbsp;CGST @${rate / 2}%</td><td></td><td class="r">${fmt(cgst)}</td></tr>`;
        rows += `<tr><td>&nbsp;&nbsp;SGST @${rate / 2}%</td><td></td><td class="r">${fmt(sgst)}</td></tr>`;
      }
      if (igst > 0) {
        rows += `<tr><td>&nbsp;&nbsp;IGST @${rate}%</td><td></td><td class="r">${fmt(igst)}</td></tr>`;
      }
      return rows;
    }).join('');

  const payRows = data.payments
    .map((p) => `<tr><td colspan="2">${p.method.toUpperCase()}</td><td class="r">${fmt(p.amount)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${data.billNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Lucida Console', monospace;
      font-size: 11px;
      width: ${width};
      padding: 4mm;
      color: #000;
      background: #fff;
    }
    h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
    h2 {
      font-size: 11px; text-align: center;
      border-top: 1px dashed #000; border-bottom: 1px dashed #000;
      padding: 3px 0; margin: 6px 0;
    }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 1px 2px; vertical-align: top; }
    th { text-align: left; font-size: 10px; }
    .c { text-align: center; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .divider-double { border-top: 2px solid #000; margin: 4px 0; }
    .total td { font-weight: bold; font-size: 12px; border-top: 2px solid #000; padding-top: 4px; }
    .center { text-align: center; }
    .small { font-size: 9px; color: #666; }
    .meta td { padding: 1px 2px; }
    @media print {
      @page { margin: 0; size: ${width} auto; }
      body { width: ${width}; }
    }
  </style>
</head>
<body>
  <h1>${data.restaurantName}</h1>
  ${data.address ? `<p class="center small">${data.address}</p>` : ''}
  ${data.phone ? `<p class="center small">Ph: ${data.phone}</p>` : ''}
  ${data.gstin ? `<p class="center small">GSTIN: ${data.gstin}</p>` : ''}
  ${data.fssaiNo ? `<p class="center small">FSSAI: ${data.fssaiNo}</p>` : ''}
  <h2>TAX INVOICE</h2>

  <table class="meta">
    <tr><td>Bill No:</td><td class="r">${data.billNumber}</td></tr>
    <tr><td>Date:</td><td class="r">${data.invoiceDate}</td></tr>
    ${data.tableName ? `<tr><td>Table:</td><td class="r">${data.tableName}</td></tr>` : ''}
    ${data.orderType !== 'dine_in' ? `<tr><td>Type:</td><td class="r">${data.orderType.replace('_', ' ').toUpperCase()}</td></tr>` : ''}
    ${data.customerName ? `<tr><td>Customer:</td><td class="r">${data.customerName}</td></tr>` : ''}
    ${data.customerGstin ? `<tr><td>Cust GSTIN:</td><td class="r">${data.customerGstin}</td></tr>` : ''}
    ${data.cashierName ? `<tr><td>Cashier:</td><td class="r">${data.cashierName}</td></tr>` : ''}
  </table>

  <div class="divider"></div>
  <table>
    <tr><th>Item</th><th class="c">Qty×Rate</th><th class="r">Amt</th></tr>
  </table>
  <div class="divider"></div>
  <table>${itemRows}</table>
  <div class="divider"></div>

  <table>
    <tr><td>Subtotal</td><td></td><td class="r">${fmt(data.subtotal)}</td></tr>
    ${data.discountAmount && data.discountAmount > 0 ? `<tr><td>Discount</td><td></td><td class="r">-${fmt(data.discountAmount)}</td></tr>` : ''}
    ${gstRows ? `<tr><td colspan="3"><div class="divider" style="margin:2px 0"></div></td></tr>${gstRows}` : ''}
    <tr><td class="b">Total GST</td><td></td><td class="r b">${fmt(data.totalTax)}</td></tr>
    ${data.roundOff && data.roundOff !== 0 ? `<tr><td>Round Off</td><td></td><td class="r">${fmt(data.roundOff)}</td></tr>` : ''}
  </table>

  <div class="divider-double"></div>
  <table>
    <tr class="total"><td colspan="2">GRAND TOTAL</td><td class="r">${fmt(data.grandTotal)}</td></tr>
  </table>
  <div class="divider-double"></div>

  <table>
    <tr><td colspan="3" class="b" style="padding-top:4px">Payment</td></tr>
    ${payRows}
    ${data.changeAmount && data.changeAmount > 0 ? `<tr><td class="b">Change</td><td></td><td class="r b">${fmt(data.changeAmount)}</td></tr>` : ''}
  </table>

  <div class="divider"></div>
  ${data.gstin ? '<p class="center small" style="margin-top:6px">This is a Computer Generated Invoice</p>' : ''}
  <p class="center" style="margin-top:4px">${data.thankYouMessage || 'Thank you for dining with us!'}</p>
  <p class="center small">Visit again :)</p>
</body>
</html>`;
}

/** KOT (Kitchen Order Ticket) printer */
export function printKot(data: {
  orderNumber: string;
  tableName?: string;
  orderType: string;
  covers?: number;
  waiter?: string;
  items: Array<{ name: string; qty: number; notes?: string }>;
  width?: PrinterWidth;
}): Uint8Array {
  const p = new EscPosBuilder(data.width || 80);

  p.alignCenter().boldOn().cmd([0x1b, 0x21, 0x10]).line('KITCHEN ORDER').cmd([0x1b, 0x21, 0x00]).boldOff();
  p.divider();
  p.alignLeft();
  p.boldOn().twoCol(`Order: ${data.orderNumber}`, new Date().toLocaleTimeString('en-IN')).boldOff();
  if (data.tableName) p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
  p.line(`Type: ${data.orderType.replace('_', ' ').toUpperCase()}`);
  if (data.waiter) p.line(`Waiter: ${data.waiter}`);
  p.divider('=');

  for (const item of data.items) {
    p.boldOn().line(`${item.qty}x ${item.name.toUpperCase()}`).boldOff();
    if (item.notes) p.line(`   ** ${item.notes} **`);
  }

  p.divider();
  p.alignCenter().line('-- END OF KOT --');
  p.cut();

  return p.build();
}