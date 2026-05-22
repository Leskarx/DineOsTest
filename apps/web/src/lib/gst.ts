/**
 * India GST Computation Utilities
 * Handles CGST/SGST (intra-state) and IGST (inter-state) calculations
 */

export interface GstBreakdown {
  taxableAmount: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  totalWithTax: number;
}

export type SupplyType = 'cgst_sgst' | 'igst' | 'exempt';

/**
 * Compute GST for a line item
 * @param baseAmount  pre-tax amount
 * @param gstRate     total GST % (e.g. 5, 12, 18, 28)
 * @param cessRate    cess % if applicable (e.g. 12 for alcohol)
 * @param supplyType  intra-state → cgst_sgst, inter-state → igst
 */
export function computeItemGst(
  baseAmount: number,
  gstRate: number,
  cessRate = 0,
  supplyType: SupplyType = 'cgst_sgst',
): GstBreakdown {
  const halfRate = gstRate / 2;

  const cgstRate = supplyType === 'cgst_sgst' ? halfRate : 0;
  const sgstRate = supplyType === 'cgst_sgst' ? halfRate : 0;
  const igstRate = supplyType === 'igst' ? gstRate : 0;

  const cgstAmount = round2(baseAmount * (cgstRate / 100));
  const sgstAmount = round2(baseAmount * (sgstRate / 100));
  const igstAmount = round2(baseAmount * (igstRate / 100));
  const cessAmount = round2(baseAmount * (cessRate / 100));
  const totalTax = cgstAmount + sgstAmount + igstAmount + cessAmount;

  return {
    taxableAmount: baseAmount,
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTax,
    totalWithTax: baseAmount + totalTax,
  };
}

/**
 * Build GST summary table for a bill (groups by GST rate slab)
 */
export interface GstSummaryRow {
  gstRate: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
}

export function buildGstSummary(
  items: Array<{
    taxableAmount: number;
    gstRate: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
  }>,
): GstSummaryRow[] {
  const map = new Map<number, GstSummaryRow>();

  for (const item of items) {
    const rate = item.gstRate;
    const existing = map.get(rate);
    if (existing) {
      existing.taxableAmount += item.taxableAmount;
      existing.cgstAmount += item.cgstAmount;
      existing.sgstAmount += item.sgstAmount;
      existing.igstAmount += item.igstAmount;
      existing.cessAmount += item.cessAmount;
      existing.totalTax += item.cgstAmount + item.sgstAmount + item.igstAmount + item.cessAmount;
    } else {
      map.set(rate, {
        gstRate: rate,
        taxableAmount: item.taxableAmount,
        cgstRate: item.cgstRate,
        cgstAmount: item.cgstAmount,
        sgstRate: item.sgstRate,
        sgstAmount: item.sgstAmount,
        igstRate: item.igstRate,
        igstAmount: item.igstAmount,
        cessAmount: item.cessAmount,
        totalTax: item.cgstAmount + item.sgstAmount + item.igstAmount + item.cessAmount,
      });
    }
  }

  return Array.from(map.values()).map((row) => ({
    ...row,
    taxableAmount: round2(row.taxableAmount),
    cgstAmount: round2(row.cgstAmount),
    sgstAmount: round2(row.sgstAmount),
    igstAmount: round2(row.igstAmount),
    cessAmount: round2(row.cessAmount),
    totalTax: round2(row.totalTax),
  }));
}

/** Convert amount in words (for invoice printing) */
export function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10] + ' ';
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = 'Rupees ' + convert(rupees).trim();
  if (paise > 0) result += ' and ' + convert(paise).trim() + ' Paise';
  return result + ' Only';
}

function round2(n: number) { return Math.round(n * 100) / 100; }

/** Standard GST slabs for Indian restaurants */
export const GST_SLABS = [
  { rate: 0, label: 'Exempt (0%)', hsnSac: '9963', description: 'Essential food items' },
  { rate: 5, label: 'GST 5%', hsnSac: '9963', description: 'Restaurant services (no AC)' },
  { rate: 12, label: 'GST 12%', hsnSac: '9963', description: 'Package food, etc.' },
  { rate: 18, label: 'GST 18%', hsnSac: '9963', description: 'AC Restaurant / Liquor license' },
  { rate: 28, label: 'GST 28%', hsnSac: '2203', description: 'Alcohol / aerated drinks' },
];
