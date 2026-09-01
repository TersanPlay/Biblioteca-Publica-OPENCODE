export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function isValidIsbn10(value: string): boolean {
  const digits = normalizeIsbn(value);
  if (!/^\d{9}[\dXx]$/.test(digits)) return false;
  const sum = digits
    .slice(0, 9)
    .split('')
    .reduce((acc, c, i) => acc + Number(c) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return (check === 10 ? 'X' : String(check)) === digits[9].toUpperCase();
}

export function isValidIsbn13(value: string): boolean {
  const digits = normalizeIsbn(value);
  if (!/^\d{13}$/.test(digits)) return false;
  const sum = digits
    .slice(0, 12)
    .split('')
    .reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[12]);
}