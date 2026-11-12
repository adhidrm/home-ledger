// Uang = integer rupiah. Tanggal = 'YYYY-MM-DD' di Asia/Jakarta.

export const rp = (n: number) =>
  'Rp' + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Ambil angka saja dari input bebas ("Rp12.500" -> 12500). */
export const parseRupiah = (s: string) => Number(s.replace(/\D/g, '') || 0);

export const todayJkt = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
  'September', 'Oktober', 'November', 'Desember'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const ymLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;

export function shiftYm(ym: string, by: number) {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export const nextMonthStart = (ym: string) => shiftYm(ym, 1) + '-01';

export const ACCOUNT_TYPES = {
  cash: 'Uang tunai',
  bank: 'Rekening bank',
  ewallet: 'Dompet digital',
  credit_card: 'Kartu kredit',
} as const;
export type AccountType = keyof typeof ACCOUNT_TYPES;
