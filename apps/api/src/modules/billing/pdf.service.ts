import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';

export interface InvoiceData {
  billNumber: string;
  issuedAt: Date;
  customerName: string;
  customerPhone?: string;
  branchName: string;
  branchAddress?: string;
  gstin?: string;
  items: Array<{ name: string; qty: number; rate: number; total: number }>;
  payments: Array<{ method: string; amount: number }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  notes?: string;
}

/* ── Colour palette ──────────────────────────────────────────────────────── */
const C = {
  brand:     '#f59e0b',  // amber-500
  dark:      '#0f172a',  // slate-900
  mid:       '#475569',  // slate-600
  light:     '#94a3b8',  // slate-400
  hairline:  '#e2e8f0',  // slate-200
  white:     '#ffffff',
  row_alt:   '#fafafa',
};

const FMT = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

@Injectable()
export class PdfService {
  private readonly appName: string;

  constructor(private readonly config: ConfigService) {
    this.appName = config.get('APP_NAME', 'Dine&Stay OS');
  }

  async generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Invoice ${data.billNumber}`,
          Author: data.branchName,
          Subject: 'Tax Invoice',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 80;   // usable width
      const L = 40;                     // left margin

      // ── Header bar ───────────────────────────────────────────────────────
      doc.rect(L, 40, W, 56).fill(C.dark);

      doc.fillColor(C.brand)
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(data.branchName, L + 16, 54, { width: W * 0.6 });

      doc.fillColor(C.white)
        .font('Helvetica')
        .fontSize(8)
        .text('TAX INVOICE', L + 16, 78);

      // Bill number & date — right aligned inside header
      const headerRight = L + W - 16;
      doc.fillColor(C.white)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(data.billNumber, 0, 54, { align: 'right', width: doc.page.width - 16 });

      doc.fillColor(C.light)
        .font('Helvetica')
        .fontSize(8)
        .text(data.issuedAt.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }), 0, 70, { align: 'right', width: doc.page.width - 16 });

      doc.moveDown(3.5);

      // ── Two-column meta ───────────────────────────────────────────────────
      const metaY = 116;
      doc.fillColor(C.mid).font('Helvetica').fontSize(8);

      // Left column — Bill To
      doc.fillColor(C.light).text('BILL TO', L, metaY);
      doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10)
        .text(data.customerName, L, metaY + 12);
      if (data.customerPhone) {
        doc.fillColor(C.mid).font('Helvetica').fontSize(8)
          .text(data.customerPhone, L, metaY + 26);
      }

      // Right column — Branch / GSTIN
      const col2 = L + W / 2 + 20;
      doc.fillColor(C.light).font('Helvetica').fontSize(8).text('FROM', col2, metaY);
      doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9)
        .text(data.branchName, col2, metaY + 12);
      if (data.branchAddress) {
        doc.fillColor(C.mid).font('Helvetica').fontSize(7.5)
          .text(data.branchAddress, col2, metaY + 25, { width: W / 2 - 20 });
      }
      if (data.gstin) {
        const gstY = data.branchAddress ? metaY + 45 : metaY + 25;
        doc.fillColor(C.mid).font('Helvetica').fontSize(7.5)
          .text(`GSTIN: ${data.gstin}`, col2, gstY);
      }

      // ── Divider ───────────────────────────────────────────────────────────
      const divY = metaY + 70;
      doc.moveTo(L, divY).lineTo(L + W, divY).strokeColor(C.hairline).lineWidth(0.5).stroke();

      // ── Items table ───────────────────────────────────────────────────────
      const tableTop = divY + 12;
      const cols = {
        item: { x: L,           w: W * 0.48 },
        qty:  { x: L + W * 0.48, w: W * 0.12 },
        rate: { x: L + W * 0.60, w: W * 0.18 },
        amt:  { x: L + W * 0.78, w: W * 0.22 },
      };

      // Table header
      doc.rect(L, tableTop, W, 18).fill(C.brand);
      doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(7.5);
      doc.text('ITEM',   cols.item.x + 4, tableTop + 5, { width: cols.item.w });
      doc.text('QTY',    cols.qty.x,  tableTop + 5, { width: cols.qty.w,  align: 'center' });
      doc.text('RATE',   cols.rate.x, tableTop + 5, { width: cols.rate.w, align: 'right' });
      doc.text('AMOUNT', cols.amt.x,  tableTop + 5, { width: cols.amt.w,  align: 'right' });

      // Rows
      let rowY = tableTop + 18;
      data.items.forEach((item, i) => {
        const rowH = 18;
        if (i % 2 === 0) doc.rect(L, rowY, W, rowH).fill(C.row_alt);

        doc.fillColor(C.dark).font('Helvetica').fontSize(8);
        doc.text(item.name, cols.item.x + 4, rowY + 5, { width: cols.item.w - 8 });
        doc.text(String(item.qty), cols.qty.x, rowY + 5, { width: cols.qty.w, align: 'center' });
        doc.text(FMT(item.rate), cols.rate.x, rowY + 5, { width: cols.rate.w, align: 'right' });
        doc.text(FMT(item.total), cols.amt.x, rowY + 5, { width: cols.amt.w, align: 'right' });
        rowY += rowH;
      });

      // Bottom border under items
      doc.moveTo(L, rowY).lineTo(L + W, rowY).strokeColor(C.hairline).lineWidth(0.5).stroke();
      rowY += 10;

      // ── Totals block ──────────────────────────────────────────────────────
      const totalsX = L + W * 0.55;
      const totalsW = W * 0.45;

      const addTotalRow = (label: string, value: number, bold = false, accent = false) => {
        doc.fillColor(accent ? C.brand : bold ? C.dark : C.mid)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(bold ? 9 : 8);
        doc.text(label, totalsX, rowY, { width: totalsW * 0.55 });
        doc.text(FMT(value), totalsX + totalsW * 0.55, rowY, { width: totalsW * 0.45, align: 'right' });
        rowY += 14;
      };

      const subtotal = data.items.reduce((s, i) => s + i.total, 0);
      addTotalRow('Subtotal', subtotal);
      if (data.cgst > 0) addTotalRow('CGST', data.cgst);
      if (data.sgst > 0) addTotalRow('SGST', data.sgst);
      if (data.igst > 0) addTotalRow('IGST', data.igst);

      // Grand total row with background
      rowY += 2;
      doc.rect(totalsX - 4, rowY - 4, totalsW + 8, 22).fill(C.dark);
      doc.fillColor(C.brand).font('Helvetica-Bold').fontSize(10)
        .text('GRAND TOTAL', totalsX, rowY, { width: totalsW * 0.55 });
      doc.fillColor(C.white)
        .text(FMT(data.grandTotal), totalsX + totalsW * 0.55, rowY, { width: totalsW * 0.45, align: 'right' });
      rowY += 28;

      // ── Payment methods ───────────────────────────────────────────────────
      if (data.payments.length > 0) {
        doc.fillColor(C.light).font('Helvetica').fontSize(7.5)
          .text('PAYMENT', L, rowY);
        rowY += 11;
        data.payments.forEach((p) => {
          doc.fillColor(C.mid).fontSize(8)
            .text(`${p.method.toUpperCase()}: ${FMT(p.amount)}`, L, rowY);
          rowY += 11;
        });
        rowY += 4;
      }

      // ── Notes ─────────────────────────────────────────────────────────────
      if (data.notes) {
        doc.moveTo(L, rowY).lineTo(L + W, rowY).strokeColor(C.hairline).lineWidth(0.5).stroke();
        rowY += 8;
        doc.fillColor(C.light).font('Helvetica').fontSize(7.5).text('NOTES', L, rowY);
        rowY += 11;
        doc.fillColor(C.mid).fontSize(8).text(data.notes, L, rowY, { width: W });
      }

      // ── Footer ────────────────────────────────────────────────────────────
      const footerY = doc.page.height - 50;
      doc.moveTo(L, footerY).lineTo(L + W, footerY).strokeColor(C.hairline).lineWidth(0.5).stroke();
      doc.fillColor(C.light).font('Helvetica').fontSize(7)
        .text('Thank you for your business!', L, footerY + 8, { align: 'center', width: W });
      doc.fillColor(C.light).fontSize(6.5)
        .text(`Generated by ${this.appName}`, L, footerY + 20, { align: 'center', width: W });

      doc.end();
    });
  }
}
