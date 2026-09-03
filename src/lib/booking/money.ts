export function poundsToPence(value: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const pounds = Number(cleaned);
  if (!Number.isFinite(pounds)) return 0;
  return Math.round(pounds * 100);
}

export function formatPounds(pence: number) {
  const amount = (pence || 0) / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export function penceToPoundsInput(pence: number) {
  return ((pence || 0) / 100).toFixed(2);
}

export function jobBalance(amountPence: number, paidPence: number) {
  return Math.max(0, amountPence - paidPence);
}

export function jobStatus(amountPence: number, paidPence: number) {
  if (amountPence <= 0 && paidPence <= 0) return 'Logged';
  if (paidPence <= 0) return 'Unpaid';
  if (paidPence >= amountPence) return 'Paid';
  return 'Part paid';
}
