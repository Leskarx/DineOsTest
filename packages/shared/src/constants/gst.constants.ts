/** Standard India GST slabs for restaurants & hotels */
export const GST_SLABS = [
  { rate: 0,  label: 'Exempt (0%)',  cgst: 0,   sgst: 0,   igst: 0,  hsn: '9963', description: 'Essential food' },
  { rate: 5,  label: 'GST 5%',      cgst: 2.5, sgst: 2.5, igst: 5,  hsn: '9963', description: 'Non-AC restaurant' },
  { rate: 12, label: 'GST 12%',     cgst: 6,   sgst: 6,   igst: 12, hsn: '9963', description: 'Packaged food' },
  { rate: 18, label: 'GST 18%',     cgst: 9,   sgst: 9,   igst: 18, hsn: '9963', description: 'AC / liquor license' },
  { rate: 28, label: 'GST 28%',     cgst: 14,  sgst: 14,  igst: 28, hsn: '2203', description: 'Alcohol / aerated' },
] as const;

/** Indian state codes for GSTIN validation */
export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha',
  '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana',
  '37': 'Andhra Pradesh (new)', '38': 'Ladakh',
};

/** GSTIN format regex */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** PAN format regex */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
