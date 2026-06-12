/**
 * ESC/POS Thermal Printer Utility
 * Supports 58mm and 80mm printers via Web Serial API or raw print
 */

export type PrinterWidth = 58 | 80;

const ESC = 0x1b;
const GS  = 0x1d;

const CMD = {
  INIT:              [ESC, 0x40],
  ALIGN_LEFT:        [ESC, 0x61, 0x00],
  ALIGN_CENTER:      [ESC, 0x61, 0x01],
  ALIGN_RIGHT:       [ESC, 0x61, 0x02],
  BOLD_ON:           [ESC, 0x45, 0x01],
  BOLD_OFF:          [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT_ON:  [ESC, 0x21, 0x10],
  DOUBLE_HEIGHT_OFF: [ESC, 0x21, 0x00],
  FONT_SMALL:        [ESC, 0x4d, 0x01],
  FONT_NORMAL:       [ESC, 0x4d, 0x00],
  UNDERLINE_ON:      [ESC, 0x2d, 0x01],
  UNDERLINE_OFF:     [ESC, 0x2d, 0x00],
  CUT:               [GS,  0x56, 0x42, 0x00],
  FEED_LINE:         [0x0a],
  BEEP:              [ESC, 0x42, 0x03, 0x02],
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

  alignLeft()    { return this.cmd(CMD.ALIGN_LEFT); }
  alignCenter()  { return this.cmd(CMD.ALIGN_CENTER); }
  alignRight()   { return this.cmd(CMD.ALIGN_RIGHT); }
  boldOn()       { return this.cmd(CMD.BOLD_ON); }
  boldOff()      { return this.cmd(CMD.BOLD_OFF); }
  feed(n = 1)    { for (let i = 0; i < n; i++) this.cmd(CMD.FEED_LINE); return this; }
  cut()          { return this.feed(4).cmd(CMD.CUT); }
  underlineOn()  { return this.cmd(CMD.UNDERLINE_ON); }
  underlineOff() { return this.cmd(CMD.UNDERLINE_OFF); }

  line(str: string) { return this.text(str).cmd(CMD.FEED_LINE); }

  divider(char = '-') { return this.line(char.repeat(this.cols)); }

  twoCol(left: string, right: string) {
    const pad = this.cols - left.length - right.length;
    return this.line(left + ' '.repeat(Math.max(1, pad)) + right);
  }

  threeCol(left: string, mid: string, right: string) {
    const remaining = this.cols - left.length - right.length;
    const padL = Math.floor((remaining - mid.length) / 2);
    const padR = remaining - mid.length - padL;
    return this.line(left + ' '.repeat(Math.max(0, padL)) + mid + ' '.repeat(Math.max(0, padR)) + right);
  }

  build(): Uint8Array { return new Uint8Array(this.buffer); }
}

export interface ReceiptData {
  restaurantName:   string;
  address?:         string;
  gstin?:           string;
  fssaiNo?:         string;
  phone?:           string;
  billNumber:       string;
  invoiceDate:      string;
  cashierName?:     string;
  tableName?:       string;
  orderType:        string;   // 'dine_in' | 'takeaway' | 'delivery' | 'room_service' | etc.
  covers?:          number;
  customerName?:    string;
  customerPhone?:   string;
  customerGstin?:   string;
  deliveryAddress?: string;
  deliveryCharge?:  number;
  /** True when delivery payment is Cash on Delivery (collected by rider) */
  isCOD?:           boolean;
  items: Array<{
    name:     string;
    qty:      number;
    rate:     number;
    amount:   number;
    gstRate?: number;
  }>;
  subtotal:         number;
  discountAmount?:  number;
  gstSummary?: Array<{
    gstRate:       number;
    taxableAmount: number;
    cgstAmount:    number;
    sgstAmount:    number;
    igstAmount:    number;
  }>;
  totalTax:         number;
  roundOff?:        number;
  grandTotal:       number;
  payments:         Array<{ method: string; amount: number }>;
  changeAmount?:    number;
  thankYouMessage?: string;
  width?:           PrinterWidth;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
function isHotelLikeReceipt(data: ReceiptData): boolean {
  const orderType = String(data.orderType || '').toLowerCase();
  const name      = String(data.restaurantName || '').toLowerCase();

  return (
    orderType === 'room_service' ||
    orderType === 'hotel' ||
    orderType === 'stay' ||
    name.includes('hotel') ||
    name.includes('resort') ||
    name.includes('inn') ||
    name.includes('suite') ||
    name.includes('stay')
  );
}

function getReceiptTitle(data: ReceiptData): string {
  const orderType   = String(data.orderType || '').toLowerCase();
  const isDelivery  = orderType === 'delivery';
  const isTakeaway  = orderType === 'takeaway';
  const isRoomSrv   = orderType === 'room_service';
  const isCOD       = isDelivery && !!data.isCOD;

  if (isDelivery) return isCOD ? 'DELIVERY ORDER — COD' : 'DELIVERY ORDER — PREPAID';
  if (isTakeaway) return 'TAKEAWAY ORDER';
  if (isRoomSrv)  return 'ROOM SERVICE BILL';
  return 'TAX INVOICE';
}

function getThankYouLines(data: ReceiptData): string[] {
  const orderType  = String(data.orderType || '').toLowerCase();
  const isDelivery = orderType === 'delivery';
  const isTakeaway = orderType === 'takeaway';
  const isRoomSrv  = orderType === 'room_service';
  const isHotel    = isHotelLikeReceipt(data);
  const isCOD      = isDelivery && !!data.isCOD;

  if (isDelivery) {
    if (isCOD) return ['Thank you!', 'Rider will collect payment on delivery.'];
    return ['Thank you for your order!', 'Delivery is on the way.'];
  }

  if (isTakeaway) {
    return ['Thank you!', 'Your order is ready for pickup.'];
  }

  if (isRoomSrv) {
    return ['Thank you for staying with us!', 'Room service has been billed.'];
  }

  if (isHotel) {
    return ['Thank you for staying with us!', 'We hope to welcome you again.'];
  }

  return [data.thankYouMessage || 'Thank you for dining with us!', 'Visit again :)'];
}

/* ─── ESC/POS builder ───────────────────────────────────────────────────── */
export function buildReceipt(data: ReceiptData): Uint8Array {
  const p   = new EscPosBuilder(data.width || 80);
  const fmt = (n: number) => `Rs.${Number(n || 0).toFixed(2)}`;

  const orderType   = String(data.orderType || '').toLowerCase();
  const isDelivery  = orderType === 'delivery';
  const isTakeaway  = orderType === 'takeaway';
  const isRoomSrv   = orderType === 'room_service';
  const isCOD       = isDelivery && !!data.isCOD;

  // Header
  p.alignCenter().boldOn().line(data.restaurantName.toUpperCase()).boldOff();
  if (data.address) p.alignCenter().line(data.address);
  if (data.phone)   p.alignCenter().line(`Ph: ${data.phone}`);
  if (data.gstin)   p.alignCenter().line(`GSTIN: ${data.gstin}`);
  if (data.fssaiNo) p.alignCenter().line(`FSSAI: ${data.fssaiNo}`);

  // Title
  p.alignCenter().boldOn().line(getReceiptTitle(data)).boldOff();

  p.divider();
  p.alignLeft();
  p.twoCol(`Bill No: ${data.billNumber}`, data.invoiceDate);

  if (data.tableName && !isDelivery && !isTakeaway && !isRoomSrv) {
    p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
  }

  if (isTakeaway) {
    if (data.customerName)  p.line(`Customer: ${data.customerName}`);
    if (data.customerPhone) p.line(`Phone: ${data.customerPhone}`);
  }

  if (isRoomSrv) {
    if (data.customerName)  p.line(`Guest: ${data.customerName}`);
    if (data.customerPhone) p.line(`Phone: ${data.customerPhone}`);
  }

  if (data.customerGstin) p.line(`Cust GSTIN: ${data.customerGstin}`);
  if (data.cashierName)   p.line(`Cashier: ${data.cashierName}`);

  if (isDelivery) {
    p.divider('=');
    p.boldOn().line('DELIVER TO:').boldOff();
    if (data.customerName)  p.line(`  ${data.customerName}`);
    if (data.customerPhone) p.line(`  Ph: ${data.customerPhone}`);
    if (data.deliveryAddress) {
      const addr   = data.deliveryAddress;
      const maxLen = 28;
      let start = 0;
      while (start < addr.length) {
        p.line(`  ${addr.slice(start, start + maxLen)}`);
        start += maxLen;
      }
    }
    if (isCOD) {
      p.divider('-');
      p.boldOn().line('** CASH ON DELIVERY **').boldOff();
      p.line(`  Rider collects: ${fmt(data.grandTotal)}`);
    }
  }

  p.divider();
  p.boldOn().threeCol('Item', 'Qty', 'Amt').boldOff();
  p.divider('-');

  for (const item of data.items) {
    const shortName = item.name.slice(0, 20);
    const qty       = Math.round(Number(item.qty || 0));
    p.threeCol(shortName, `${qty}x${fmt(item.rate)}`, fmt(item.amount));
  }

  p.divider();
  p.twoCol('Subtotal', fmt(data.subtotal));

  if (data.discountAmount && data.discountAmount > 0) {
    p.twoCol('Discount', `-${fmt(data.discountAmount)}`);
  }

  if (isDelivery && data.deliveryCharge && data.deliveryCharge > 0) {
    p.twoCol('Delivery Charge', fmt(data.deliveryCharge));
  }

  if (data.gstSummary?.length) {
    p.divider('-');
    p.boldOn().line('GST Details').boldOff();
    for (const row of data.gstSummary) {
      const gstRate       = Number(row.gstRate || 0);
      const taxableAmount = Number(row.taxableAmount || 0);
      const cgstAmount    = Number(row.cgstAmount || 0);
      const sgstAmount    = Number(row.sgstAmount || 0);
      const igstAmount    = Number(row.igstAmount || 0);

      p.twoCol(`Taxable @${gstRate}%`, fmt(taxableAmount));
      if (cgstAmount > 0) {
        p.twoCol(`  CGST @${gstRate / 2}%`, fmt(cgstAmount));
        p.twoCol(`  SGST @${gstRate / 2}%`, fmt(sgstAmount));
      } else if (igstAmount > 0) {
        p.twoCol(`  IGST @${gstRate}%`, fmt(igstAmount));
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

  if (isCOD) {
    p.boldOn().line('Payment: CASH ON DELIVERY').boldOff();
    p.line(`Rider collects: ${fmt(data.grandTotal)}`);
  } else {
    p.boldOn().line('Payment').boldOff();
    for (const pay of data.payments) {
      p.twoCol(`  ${String(pay.method || '').toUpperCase()}`, fmt(pay.amount));
    }
    if (data.changeAmount && data.changeAmount > 0) {
      p.twoCol('Change', fmt(data.changeAmount));
    }
  }

  p.divider();
  p.alignCenter();
  if (data.gstin) p.line('This is a Computer Generated Invoice');

  const thankYouLines = getThankYouLines(data);
  thankYouLines.forEach((line) => p.line(line));

  p.cut();
  return p.build();
}

/* ─── Web Serial print ──────────────────────────────────────────────────── */
export async function printSerial(data: ReceiptData): Promise<void> {
  if (!('serial' in navigator)) {
    throw new Error('Web Serial API not supported. Use Chrome 89+ or a compatible browser.');
  }
  const bytes  = buildReceipt(data);
  const port   = await (navigator as any).serial.requestPort();
  await port.open({ baudRate: 9600 });
  const writer = port.writable.getWriter();
  await writer.write(bytes);
  writer.releaseLock();
  await port.close();
}

/* ─── HTML print ────────────────────────────────────────────────────────── */
export function printHtml(data: ReceiptData): void {
  const html = buildReceiptHtml(data);

  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText =
      'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) throw new Error('Cannot access iframe document');

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        printViaPopup(html);
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 2000);
    }, 300);

    return;
  } catch {
    console.warn('Iframe method failed, falling back to popup');
  }

  printViaPopup(html);
}

function printViaPopup(html: string): void {
  const win = window.open('', '_blank', 'width=400,height=700');
  if (!win) {
    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href   = url;
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

/* ─── HTML receipt builder ─────────────────────────────────────────────── */
function buildReceiptHtml(data: ReceiptData): string {
  const width = data.width === 58 ? '58mm' : '80mm';
  const fmt   = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

  const orderType  = String(data.orderType || '').toLowerCase();
  const isDelivery = orderType === 'delivery';
  const isTakeaway = orderType === 'takeaway';
  const isRoomSrv  = orderType === 'room_service';
  const isCOD      = isDelivery && !!data.isCOD;

  const titleText = getReceiptTitle(data);
  const thankYouLines = getThankYouLines(data);

  const deliverToSection = isDelivery ? `
    <div class="deliver-to">
      <div class="deliver-to-title">DELIVER TO</div>
      ${data.customerName ? `<div class="deliver-row"><span>Name</span><span>${data.customerName}</span></div>` : ''}
      ${data.customerPhone ? `<div class="deliver-row phone"><span>Phone</span><span>${data.customerPhone}</span></div>` : ''}
      ${data.deliveryAddress ? `<div class="deliver-row address"><span>Address</span><span>${data.deliveryAddress}</span></div>` : ''}
    </div>
    ${isCOD ? `
      <div class="cod-box">
        <div class="cod-title">💵 CASH ON DELIVERY</div>
        <div class="cod-amount">Rider collects: ${fmt(data.grandTotal)}</div>
      </div>
    ` : ''}
    <div class="divider"></div>
  ` : '';

  const metaRows = `
    <tr><td>Bill No:</td><td class="r">${data.billNumber}</td></tr>
    <tr><td>Date:</td><td class="r">${data.invoiceDate}</td></tr>
    ${data.tableName && !isDelivery && !isTakeaway && !isRoomSrv ? `<tr><td>Table:</td><td class="r">${data.tableName}</td></tr>` : ''}
    ${isTakeaway && data.customerName ? `<tr><td>Customer:</td><td class="r">${data.customerName}</td></tr>` : ''}
    ${isTakeaway && data.customerPhone ? `<tr><td>Phone:</td><td class="r">${data.customerPhone}</td></tr>` : ''}
    ${isRoomSrv && data.customerName ? `<tr><td>Guest:</td><td class="r">${data.customerName}</td></tr>` : ''}
    ${isRoomSrv && data.customerPhone ? `<tr><td>Phone:</td><td class="r">${data.customerPhone}</td></tr>` : ''}
    ${data.customerGstin ? `<tr><td>Cust GSTIN:</td><td class="r">${data.customerGstin}</td></tr>` : ''}
    ${data.cashierName ? `<tr><td>Cashier:</td><td class="r">${data.cashierName}</td></tr>` : ''}
  `;

  const itemRows = (data.items || [])
    .map((i) => `
      <tr>
        <td>${i.name}</td>
        <td class="c">${Math.round(Number(i.qty || 0))}×${fmt(i.rate)}</td>
        <td class="r">${fmt(i.amount)}</td>
      </tr>
    `)
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
    })
    .join('');

  const payRows = isCOD
    ? `
      <tr>
        <td colspan="2" class="b">CASH ON DELIVERY</td>
        <td class="r b">${fmt(data.grandTotal)}</td>
      </tr>
      <tr>
        <td colspan="3" class="small" style="padding-top:2px">Rider will collect on delivery</td>
      </tr>
    `
    : (data.payments || [])
        .map((p) => `
          <tr>
            <td colspan="2">${String(p.method || '').toUpperCase()}</td>
            <td class="r">${fmt(p.amount)}</td>
          </tr>
        `)
        .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
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
      font-size: 12px;
      text-align: center;
      font-weight: bold;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 4px 0;
      margin: 6px 0;
      letter-spacing: 1px;
    }
    h2.delivery         { background: #000; color: #fff; border: none; padding: 5px 0; }
    h2.delivery-prepaid { background: #444; color: #fff; border: none; padding: 5px 0; }
    h2.takeaway         { border: 2px solid #000; }

    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 1px 2px; vertical-align: top; }
    th { text-align: left; font-size: 10px; }
    .c { text-align: center; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .divider-double { border-top: 2px solid #000; margin: 4px 0; }
    .total td {
      font-weight: bold;
      font-size: 13px;
      border-top: 2px solid #000;
      padding-top: 4px;
    }
    .center { text-align: center; }
    .small { font-size: 9px; color: #555; }
    .meta td { padding: 1px 2px; }

    .deliver-to {
      border: 2px solid #000;
      padding: 5px;
      margin: 6px 0;
      border-radius: 2px;
    }
    .deliver-to-title {
      font-weight: bold;
      font-size: 11px;
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 3px;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
    .deliver-row {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      padding: 1px 0;
      font-size: 10px;
    }
    .deliver-row span:first-child { color: #555; flex-shrink: 0; }
    .deliver-row span:last-child { text-align: right; font-weight: bold; }
    .deliver-row.phone span:last-child { font-size: 12px; }
    .deliver-row.address span:last-child {
      font-weight: normal;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .cod-box {
      border: 2px solid #000;
      background: #f0f0f0;
      padding: 5px;
      margin: 4px 0;
      text-align: center;
    }
    .cod-title { font-weight: bold; font-size: 12px; letter-spacing: 1px; }
    .cod-amount { font-size: 13px; font-weight: bold; margin-top: 2px; }

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

  <h2 class="${
    isDelivery
      ? (isCOD ? 'delivery' : 'delivery-prepaid')
      : isTakeaway
        ? 'takeaway'
        : ''
  }">${titleText}</h2>

  <table class="meta">${metaRows}</table>

  ${deliverToSection}

  <div class="divider"></div>
  <table>
    <tr><th>Item</th><th class="c">Qty×Rate</th><th class="r">Amt</th></tr>
  </table>
  <div class="divider"></div>
  <table>${itemRows}</table>
  <div class="divider"></div>

  <table>
    <tr><td>Subtotal</td><td></td><td class="r">${fmt(data.subtotal)}</td></tr>
    ${data.discountAmount && data.discountAmount > 0
      ? `<tr><td>Discount</td><td></td><td class="r">-${fmt(data.discountAmount)}</td></tr>`
      : ''}
    ${isDelivery && data.deliveryCharge && data.deliveryCharge > 0
      ? `<tr><td>Delivery Charge</td><td></td><td class="r">${fmt(data.deliveryCharge)}</td></tr>`
      : ''}
    ${gstRows
      ? `<tr><td colspan="3"><div class="divider" style="margin:2px 0"></div></td></tr>
         <tr><td colspan="3" class="b" style="font-size:10px;padding:1px 2px">GST Breakup</td></tr>
         ${gstRows}`
      : ''}
    <tr><td class="b">Total GST</td><td></td><td class="r b">${fmt(data.totalTax)}</td></tr>
    ${data.roundOff && data.roundOff !== 0
      ? `<tr><td>Round Off</td><td></td><td class="r">${fmt(data.roundOff)}</td></tr>`
      : ''}
  </table>

  <div class="divider-double"></div>
  <table>
    <tr class="total"><td colspan="2">GRAND TOTAL</td><td class="r">${fmt(data.grandTotal)}</td></tr>
  </table>
  <div class="divider-double"></div>

  <table>
    <tr><td colspan="3" class="b" style="padding-top:4px">Payment</td></tr>
    ${payRows}
    ${!isCOD && data.changeAmount && data.changeAmount > 0
      ? `<tr><td class="b">Change</td><td></td><td class="r b">${fmt(data.changeAmount)}</td></tr>`
      : ''}
  </table>

  <div class="divider"></div>
  ${data.gstin ? '<p class="center small" style="margin-top:4px">This is a Computer Generated Invoice</p>' : ''}
  ${thankYouLines.map((line, i) =>
    `<p class="center${i === 0 ? '' : ' small'}" style="margin-top:${i === 0 ? '6px' : '2px'}">${line}</p>`
  ).join('')}
</body>
</html>`;
}

/* ─── KOT printer ───────────────────────────────────────────────────────── */
export function printKot(data: {
  orderNumber:    string;
  tableName?:     string;
  orderType:      string;
  covers?:        number;
  waiter?:        string;
  kotRound?:      number;
  customerName?:  string;
  customerPhone?: string;
  items: Array<{ name: string; qty: number; notes?: string }>;
  width?: PrinterWidth;
}): Uint8Array {
  const p = new EscPosBuilder(data.width || 80);

  p.alignCenter()
    .boldOn()
    .cmd([0x1b, 0x21, 0x10])
    .line('KITCHEN ORDER')
    .cmd([0x1b, 0x21, 0x00])
    .boldOff();

  if (data.kotRound && data.kotRound > 1) {
    p.alignCenter().boldOn().line(`-- ADD-ON KOT #${data.kotRound} --`).boldOff();
  }

  p.divider();
  p.alignLeft();
  p.boldOn().twoCol(`Order: ${data.orderNumber}`, new Date().toLocaleTimeString('en-IN')).boldOff();

  if (data.tableName) p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
  p.line(`Type: ${String(data.orderType || '').replace('_', ' ').toUpperCase()}`);

  if (data.orderType === 'delivery') {
    if (data.customerName)  p.line(`Customer: ${data.customerName}`);
    if (data.customerPhone) p.line(`Phone: ${data.customerPhone}`);
  }

  if (data.waiter) p.line(`Waiter: ${data.waiter}`);
  p.divider('=');

  for (const item of data.items) {
    p.boldOn().line(`${Math.round(Number(item.qty || 0))}x ${String(item.name || '').toUpperCase()}`).boldOff();
    if (item.notes) p.line(`   ** ${item.notes} **`);
  }

  p.divider();
  p.alignCenter().line('-- END OF KOT --');
  p.cut();

  return p.build();
}

// /**
//  * ESC/POS Thermal Printer Utility
//  * Supports 58mm and 80mm printers via Web Serial API or raw print
//  */

// export type PrinterWidth = 58 | 80;

// const ESC = 0x1b;
// const GS  = 0x1d;

// const CMD = {
//   INIT:              [ESC, 0x40],
//   ALIGN_LEFT:        [ESC, 0x61, 0x00],
//   ALIGN_CENTER:      [ESC, 0x61, 0x01],
//   ALIGN_RIGHT:       [ESC, 0x61, 0x02],
//   BOLD_ON:           [ESC, 0x45, 0x01],
//   BOLD_OFF:          [ESC, 0x45, 0x00],
//   DOUBLE_HEIGHT_ON:  [ESC, 0x21, 0x10],
//   DOUBLE_HEIGHT_OFF: [ESC, 0x21, 0x00],
//   FONT_SMALL:        [ESC, 0x4d, 0x01],
//   FONT_NORMAL:       [ESC, 0x4d, 0x00],
//   UNDERLINE_ON:      [ESC, 0x2d, 0x01],
//   UNDERLINE_OFF:     [ESC, 0x2d, 0x00],
//   CUT:               [GS,  0x56, 0x42, 0x00],
//   FEED_LINE:         [0x0a],
//   BEEP:              [ESC, 0x42, 0x03, 0x02],
// };

// class EscPosBuilder {
//   private buffer: number[] = [];
//   private cols: number;

//   constructor(width: PrinterWidth = 80) {
//     this.cols = width === 58 ? 32 : 48;
//     this.cmd(CMD.INIT);
//   }

//   cmd(bytes: number[]) { this.buffer.push(...bytes); return this; }

//   private text(str: string) {
//     for (const ch of str) this.buffer.push(ch.charCodeAt(0));
//     return this;
//   }

//   alignLeft()   { return this.cmd(CMD.ALIGN_LEFT); }
//   alignCenter() { return this.cmd(CMD.ALIGN_CENTER); }
//   alignRight()  { return this.cmd(CMD.ALIGN_RIGHT); }
//   boldOn()      { return this.cmd(CMD.BOLD_ON); }
//   boldOff()     { return this.cmd(CMD.BOLD_OFF); }
//   feed(n = 1)   { for (let i = 0; i < n; i++) this.cmd(CMD.FEED_LINE); return this; }
//   cut()         { return this.feed(4).cmd(CMD.CUT); }
//   underlineOn() { return this.cmd(CMD.UNDERLINE_ON); }
//   underlineOff(){ return this.cmd(CMD.UNDERLINE_OFF); }

//   line(str: string) { return this.text(str).cmd(CMD.FEED_LINE); }

//   divider(char = '-') { return this.line(char.repeat(this.cols)); }

//   twoCol(left: string, right: string) {
//     const pad = this.cols - left.length - right.length;
//     return this.line(left + ' '.repeat(Math.max(1, pad)) + right);
//   }

//   threeCol(left: string, mid: string, right: string) {
//     const remaining = this.cols - left.length - right.length;
//     const padL = Math.floor((remaining - mid.length) / 2);
//     const padR  = remaining - mid.length - padL;
//     return this.line(left + ' '.repeat(padL) + mid + ' '.repeat(padR) + right);
//   }

//   build(): Uint8Array { return new Uint8Array(this.buffer); }
// }

// export interface ReceiptData {
//   restaurantName: string;
//   address?:       string;
//   gstin?:         string;
//   fssaiNo?:       string;
//   phone?:         string;
//   billNumber:     string;
//   invoiceDate:    string;
//   cashierName?:   string;
//   tableName?:     string;
//   orderType:      string;   // 'dine_in' | 'takeaway' | 'delivery'
//   covers?:        number;
//   customerName?:  string;
//   customerPhone?: string;   // mandatory for delivery
//   customerGstin?: string;
//   deliveryAddress?: string; // mandatory for delivery
//   deliveryCharge?:  number; // optional delivery surcharge
//   items: Array<{
//     name:     string;
//     qty:      number;
//     rate:     number;
//     amount:   number;
//     gstRate?: number;
//   }>;
//   subtotal:       number;
//   discountAmount?: number;
//   gstSummary?: Array<{
//     gstRate:       number;
//     taxableAmount: number;
//     cgstAmount:    number;
//     sgstAmount:    number;
//     igstAmount:    number;
//   }>;
//   totalTax:      number;
//   roundOff?:     number;
//   grandTotal:    number;
//   payments:      Array<{ method: string; amount: number }>;
//   changeAmount?: number;
//   thankYouMessage?: string;
//   width?:        PrinterWidth;
// }

// /* ─── ESC/POS builder ────────────────────────────────────────────────────── */
// export function buildReceipt(data: ReceiptData): Uint8Array {
//   const p   = new EscPosBuilder(data.width || 80);
//   const fmt = (n: number) => `Rs.${n.toFixed(2)}`;

//   const isDelivery = data.orderType === 'delivery';
//   const isTakeaway = data.orderType === 'takeaway';

//   // Header
//   p.alignCenter().boldOn().line(data.restaurantName.toUpperCase()).boldOff();
//   if (data.address) p.alignCenter().line(data.address);
//   if (data.phone)   p.alignCenter().line(`Ph: ${data.phone}`);
//   if (data.gstin)   p.alignCenter().line(`GSTIN: ${data.gstin}`);
//   if (data.fssaiNo) p.alignCenter().line(`FSSAI: ${data.fssaiNo}`);

//   // Title changes by order type
//   if (isDelivery) {
//     p.alignCenter().boldOn().line('DELIVERY ORDER').boldOff();
//   } else if (isTakeaway) {
//     p.alignCenter().boldOn().line('TAKEAWAY ORDER').boldOff();
//   } else {
//     p.alignCenter().boldOn().line('TAX INVOICE').boldOff();
//   }

//   p.divider();
//   p.alignLeft();
//   p.twoCol(`Bill No: ${data.billNumber}`, data.invoiceDate);

//   // Dine-in: show table
//   if (data.tableName && !isDelivery && !isTakeaway) {
//     p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
//   }

//   // Takeaway: show customer if available
//   if (isTakeaway) {
//     if (data.customerName)  p.line(`Customer: ${data.customerName}`);
//     if (data.customerPhone) p.line(`Phone: ${data.customerPhone}`);
//   }

//   if (data.customerGstin) p.line(`Cust GSTIN: ${data.customerGstin}`);
//   if (data.cashierName)   p.line(`Cashier: ${data.cashierName}`);

//   // Delivery: DELIVER TO section
//   if (isDelivery) {
//     p.divider('=');
//     p.boldOn().line('DELIVER TO:').boldOff();
//     if (data.customerName)    p.line(`  ${data.customerName}`);
//     if (data.customerPhone)   p.line(`  Ph: ${data.customerPhone}`);
//     if (data.deliveryAddress) {
//       // Word wrap address at cols-4 chars
//       const addr   = data.deliveryAddress;
//       const maxLen = 28;
//       let   start  = 0;
//       while (start < addr.length) {
//         p.line(`  ${addr.slice(start, start + maxLen)}`);
//         start += maxLen;
//       }
//     }
//   }

//   p.divider();
//   p.boldOn().threeCol('Item', 'Qty', 'Amt').boldOff();
//   p.divider('-');

//   for (const item of data.items) {
//     const shortName = item.name.slice(0, 20);
//     p.threeCol(shortName, `${item.qty}x${fmt(item.rate)}`, fmt(item.amount));
//   }

//   p.divider();
//   p.twoCol('Subtotal', fmt(data.subtotal));

//   if (data.discountAmount && data.discountAmount > 0) {
//     p.twoCol('Discount', `-${fmt(data.discountAmount)}`);
//   }

//   // Delivery charge line
//   if (isDelivery && data.deliveryCharge && data.deliveryCharge > 0) {
//     p.twoCol('Delivery Charge', fmt(data.deliveryCharge));
//   }

//   if (data.gstSummary?.length) {
//     p.divider('-');
//     p.boldOn().line('GST Details').boldOff();
//     for (const row of data.gstSummary) {
//       p.twoCol(`Taxable @${row.gstRate}%`, fmt(row.taxableAmount));
//       if (row.cgstAmount > 0) {
//         p.twoCol(`  CGST @${row.gstRate / 2}%`, fmt(row.cgstAmount));
//         p.twoCol(`  SGST @${row.gstRate / 2}%`, fmt(row.sgstAmount));
//       } else if (row.igstAmount > 0) {
//         p.twoCol(`  IGST @${row.gstRate}%`, fmt(row.igstAmount));
//       }
//     }
//     p.divider('-');
//     p.twoCol('Total GST', fmt(data.totalTax));
//   } else {
//     p.twoCol('GST', fmt(data.totalTax));
//   }

//   if (data.roundOff && data.roundOff !== 0) {
//     p.twoCol('Round Off', fmt(data.roundOff));
//   }

//   p.divider('=');
//   p.boldOn().twoCol('GRAND TOTAL', fmt(data.grandTotal)).boldOff();
//   p.divider('=');

//   p.boldOn().line('Payment').boldOff();
//   for (const pay of data.payments) {
//     p.twoCol(`  ${pay.method.toUpperCase()}`, fmt(pay.amount));
//   }
//   if (data.changeAmount && data.changeAmount > 0) {
//     p.twoCol('Change', fmt(data.changeAmount));
//   }

//   p.divider();
//   p.alignCenter();
//   if (data.gstin) p.line('This is a Computer Generated Invoice');

//   if (isDelivery) {
//     p.line('Thank you for your order!');
//     p.line('Delivery is on the way :)');
//   } else if (isTakeaway) {
//     p.line('Thank you! Your order is ready.');
//     p.line('Visit again :)');
//   } else {
//     p.line(data.thankYouMessage || 'Thank you for dining with us!');
//     p.line('Visit again :)');
//   }

//   p.cut();
//   return p.build();
// }

// /* ─── Web Serial print ────────────────────────────────────────────────────── */
// export async function printSerial(data: ReceiptData): Promise<void> {
//   if (!('serial' in navigator)) {
//     throw new Error('Web Serial API not supported. Use Chrome 89+ or a compatible browser.');
//   }
//   const bytes  = buildReceipt(data);
//   const port   = await (navigator as any).serial.requestPort();
//   await port.open({ baudRate: 9600 });
//   const writer = port.writable.getWriter();
//   await writer.write(bytes);
//   writer.releaseLock();
//   await port.close();
// }

// /* ─── HTML print ──────────────────────────────────────────────────────────── */
// export function printHtml(data: ReceiptData): void {
//   const html = buildReceiptHtml(data);

//   try {
//     const iframe = document.createElement('iframe');
//     iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none;';
//     document.body.appendChild(iframe);

//     const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
//     if (!iframeDoc) throw new Error('Cannot access iframe document');

//     iframeDoc.open();
//     iframeDoc.write(html);
//     iframeDoc.close();

//     setTimeout(() => {
//       try {
//         iframe.contentWindow?.focus();
//         iframe.contentWindow?.print();
//       } catch {
//         printViaPopup(html);
//       }
//       setTimeout(() => {
//         try { document.body.removeChild(iframe); } catch { /* already removed */ }
//       }, 2000);
//     }, 300);

//     return;
//   } catch {
//     console.warn('Iframe method failed, falling back to popup');
//   }

//   printViaPopup(html);
// }

// function printViaPopup(html: string): void {
//   const win = window.open('', '_blank', 'width=400,height=700');
//   if (!win) {
//     const blob = new Blob([html], { type: 'text/html' });
//     const url  = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href   = url;
//     link.target = '_blank';
//     link.click();
//     setTimeout(() => URL.revokeObjectURL(url), 5000);
//     return;
//   }
//   win.document.write(html);
//   win.document.close();
//   win.focus();
//   setTimeout(() => { win.print(); setTimeout(() => win.close(), 1000); }, 500);
// }

// /* ─── HTML receipt builder ────────────────────────────────────────────────── */
// function buildReceiptHtml(data: ReceiptData): string {
//   const width = data.width === 58 ? '58mm' : '80mm';
//   const fmt   = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

//   const isDelivery = data.orderType === 'delivery';
//   const isTakeaway = data.orderType === 'takeaway';

//   // Title
//   const titleText = isDelivery ? 'DELIVERY ORDER' : isTakeaway ? 'TAKEAWAY ORDER' : 'TAX INVOICE';

//   // Deliver-To section (only for delivery)
//   const deliverToSection = isDelivery ? `
//     <div class="deliver-to">
//       <div class="deliver-to-title">DELIVER TO</div>
//       ${data.customerName    ? `<div class="deliver-row"><span>Name</span><span>${data.customerName}</span></div>` : ''}
//       ${data.customerPhone   ? `<div class="deliver-row phone"><span>Phone</span><span>${data.customerPhone}</span></div>` : ''}
//       ${data.deliveryAddress ? `<div class="deliver-row address"><span>Address</span><span>${data.deliveryAddress}</span></div>` : ''}
//     </div>
//     <div class="divider"></div>
//   ` : '';

//   // Meta rows
//   const metaRows = `
//     <tr><td>Bill No:</td><td class="r">${data.billNumber}</td></tr>
//     <tr><td>Date:</td><td class="r">${data.invoiceDate}</td></tr>
//     ${data.tableName && !isDelivery && !isTakeaway ? `<tr><td>Table:</td><td class="r">${data.tableName}</td></tr>` : ''}
//     ${isTakeaway && data.customerName  ? `<tr><td>Customer:</td><td class="r">${data.customerName}</td></tr>` : ''}
//     ${isTakeaway && data.customerPhone ? `<tr><td>Phone:</td><td class="r">${data.customerPhone}</td></tr>` : ''}
//     ${data.customerGstin ? `<tr><td>Cust GSTIN:</td><td class="r">${data.customerGstin}</td></tr>` : ''}
//     ${data.cashierName   ? `<tr><td>Cashier:</td><td class="r">${data.cashierName}</td></tr>` : ''}
//   `;

//   const itemRows = data.items
//     .map((i) => `
//       <tr>
//         <td>${i.name}</td>
//         <td class="c">${i.qty}×${fmt(i.rate)}</td>
//         <td class="r">${fmt(i.amount)}</td>
//       </tr>
//     `)
//     .join('');

//   const gstRows = (data.gstSummary || [])
//     .map((g) => {
//       const taxable = Number(g.taxableAmount || 0);
//       const cgst    = Number(g.cgstAmount    || 0);
//       const sgst    = Number(g.sgstAmount    || 0);
//       const igst    = Number(g.igstAmount    || 0);
//       const rate    = Number(g.gstRate       || 0);
//       let rows = `<tr><td>Taxable @${rate}%</td><td></td><td class="r">${fmt(taxable)}</td></tr>`;
//       if (cgst > 0) {
//         rows += `<tr><td>&nbsp;&nbsp;CGST @${rate / 2}%</td><td></td><td class="r">${fmt(cgst)}</td></tr>`;
//         rows += `<tr><td>&nbsp;&nbsp;SGST @${rate / 2}%</td><td></td><td class="r">${fmt(sgst)}</td></tr>`;
//       }
//       if (igst > 0) {
//         rows += `<tr><td>&nbsp;&nbsp;IGST @${rate}%</td><td></td><td class="r">${fmt(igst)}</td></tr>`;
//       }
//       return rows;
//     }).join('');

//   const payRows = data.payments
//     .map((p) => `<tr><td colspan="2">${p.method.toUpperCase()}</td><td class="r">${fmt(p.amount)}</td></tr>`)
//     .join('');

//   const thankYou = isDelivery
//     ? 'Thank you for your order! Delivery is on the way.'
//     : isTakeaway
//     ? 'Thank you! Your order is ready for pickup.'
//     : (data.thankYouMessage || 'Thank you for dining with us!');

//   return `<!DOCTYPE html>
// <html>
// <head>
//   <meta charset="UTF-8">
//   <title>Receipt - ${data.billNumber}</title>
//   <style>
//     * { margin: 0; padding: 0; box-sizing: border-box; }
//     body {
//       font-family: 'Courier New', 'Lucida Console', monospace;
//       font-size: 11px;
//       width: ${width};
//       padding: 4mm;
//       color: #000;
//       background: #fff;
//     }
//     h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
//     h2 {
//       font-size: 12px; text-align: center; font-weight: bold;
//       border-top: 1px dashed #000; border-bottom: 1px dashed #000;
//       padding: 4px 0; margin: 6px 0;
//       letter-spacing: 1px;
//     }
//     /* Delivery order specific */
//     h2.delivery { background: #000; color: #fff; border: none; padding: 5px 0; }
//     h2.takeaway { border: 2px solid #000; }

//     table { width: 100%; border-collapse: collapse; }
//     td, th { padding: 1px 2px; vertical-align: top; }
//     th { text-align: left; font-size: 10px; }
//     .c { text-align: center; }
//     .r { text-align: right; }
//     .b { font-weight: bold; }
//     .divider { border-top: 1px dashed #000; margin: 4px 0; }
//     .divider-double { border-top: 2px solid #000; margin: 4px 0; }
//     .total td { font-weight: bold; font-size: 13px; border-top: 2px solid #000; padding-top: 4px; }
//     .center { text-align: center; }
//     .small { font-size: 9px; color: #555; }
//     .meta td { padding: 1px 2px; }

//     /* Deliver To box */
//     .deliver-to {
//       border: 2px solid #000;
//       padding: 5px;
//       margin: 6px 0;
//       border-radius: 2px;
//     }
//     .deliver-to-title {
//       font-weight: bold;
//       font-size: 11px;
//       text-align: center;
//       border-bottom: 1px dashed #000;
//       padding-bottom: 3px;
//       margin-bottom: 4px;
//       letter-spacing: 1px;
//     }
//     .deliver-row {
//       display: flex;
//       justify-content: space-between;
//       gap: 4px;
//       padding: 1px 0;
//       font-size: 10px;
//     }
//     .deliver-row span:first-child {
//       color: #555;
//       flex-shrink: 0;
//     }
//     .deliver-row span:last-child {
//       text-align: right;
//       font-weight: bold;
//     }
//     .deliver-row.phone span:last-child { font-size: 12px; }
//     .deliver-row.address span:last-child {
//       font-weight: normal;
//       white-space: pre-wrap;
//       word-break: break-word;
//     }

//     @media print {
//       @page { margin: 0; size: ${width} auto; }
//       body { width: ${width}; }
//     }
//   </style>
// </head>
// <body>
//   <h1>${data.restaurantName}</h1>
//   ${data.address  ? `<p class="center small">${data.address}</p>`       : ''}
//   ${data.phone    ? `<p class="center small">Ph: ${data.phone}</p>`     : ''}
//   ${data.gstin    ? `<p class="center small">GSTIN: ${data.gstin}</p>`  : ''}
//   ${data.fssaiNo  ? `<p class="center small">FSSAI: ${data.fssaiNo}</p>`: ''}

//   <h2 class="${isDelivery ? 'delivery' : isTakeaway ? 'takeaway' : ''}">${titleText}</h2>

//   <table class="meta">${metaRows}</table>

//   ${deliverToSection}

//   <div class="divider"></div>
//   <table>
//     <tr><th>Item</th><th class="c">Qty×Rate</th><th class="r">Amt</th></tr>
//   </table>
//   <div class="divider"></div>
//   <table>${itemRows}</table>
//   <div class="divider"></div>

//   <table>
//     <tr><td>Subtotal</td><td></td><td class="r">${fmt(data.subtotal)}</td></tr>
//     ${data.discountAmount && data.discountAmount > 0
//       ? `<tr><td>Discount</td><td></td><td class="r">-${fmt(data.discountAmount)}</td></tr>`
//       : ''}
//     ${isDelivery && data.deliveryCharge && data.deliveryCharge > 0
//       ? `<tr><td>Delivery Charge</td><td></td><td class="r">${fmt(data.deliveryCharge)}</td></tr>`
//       : ''}
//     ${gstRows
//       ? `<tr><td colspan="3"><div class="divider" style="margin:2px 0"></div></td></tr>
//          <tr><td colspan="3" class="b" style="font-size:10px;padding:1px 2px">GST Breakup</td></tr>
//          ${gstRows}`
//       : ''}
//     <tr><td class="b">Total GST</td><td></td><td class="r b">${fmt(data.totalTax)}</td></tr>
//     ${data.roundOff && data.roundOff !== 0
//       ? `<tr><td>Round Off</td><td></td><td class="r">${fmt(data.roundOff)}</td></tr>`
//       : ''}
//   </table>

//   <div class="divider-double"></div>
//   <table>
//     <tr class="total"><td colspan="2">GRAND TOTAL</td><td class="r">${fmt(data.grandTotal)}</td></tr>
//   </table>
//   <div class="divider-double"></div>

//   <table>
//     <tr><td colspan="3" class="b" style="padding-top:4px">Payment</td></tr>
//     ${payRows}
//     ${data.changeAmount && data.changeAmount > 0
//       ? `<tr><td class="b">Change</td><td></td><td class="r b">${fmt(data.changeAmount)}</td></tr>`
//       : ''}
//   </table>

//   <div class="divider"></div>
//   ${data.gstin ? '<p class="center small" style="margin-top:4px">This is a Computer Generated Invoice</p>' : ''}
//   <p class="center" style="margin-top:6px">${thankYou}</p>
//   <p class="center small" style="margin-top:2px">Visit again :)</p>
// </body>
// </html>`;
// }

// /* ─── KOT printer ─────────────────────────────────────────────────────────── */
// export function printKot(data: {
//   orderNumber: string;
//   tableName?:  string;
//   orderType:   string;
//   covers?:     number;
//   waiter?:     string;
//   kotRound?:   number;
//   customerName?:  string;
//   customerPhone?: string;
//   items: Array<{ name: string; qty: number; notes?: string }>;
//   width?: PrinterWidth;
// }): Uint8Array {
//   const p = new EscPosBuilder(data.width || 80);

//   p.alignCenter().boldOn().cmd([0x1b, 0x21, 0x10]).line('KITCHEN ORDER').cmd([0x1b, 0x21, 0x00]).boldOff();
//   if (data.kotRound && data.kotRound > 1) {
//     p.alignCenter().boldOn().line(`-- ADD-ON KOT #${data.kotRound} --`).boldOff();
//   }
//   p.divider();
//   p.alignLeft();
//   p.boldOn().twoCol(`Order: ${data.orderNumber}`, new Date().toLocaleTimeString('en-IN')).boldOff();
//   if (data.tableName) p.twoCol(`Table: ${data.tableName}`, `Covers: ${data.covers || 1}`);
//   p.line(`Type: ${data.orderType.replace('_', ' ').toUpperCase()}`);
//   if (data.orderType === 'delivery') {
//     if (data.customerName)  p.line(`Customer: ${data.customerName}`);
//     if (data.customerPhone) p.line(`Phone: ${data.customerPhone}`);
//   }
//   if (data.waiter) p.line(`Waiter: ${data.waiter}`);
//   p.divider('=');

//   for (const item of data.items) {
//     p.boldOn().line(`${item.qty}x ${item.name.toUpperCase()}`).boldOff();
//     if (item.notes) p.line(`   ** ${item.notes} **`);
//   }

//   p.divider();
//   p.alignCenter().line('-- END OF KOT --');
//   p.cut();

//   return p.build();
// }