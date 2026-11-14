// Item struk dan item pengeluaran manual: bentuk draf di form, validasi, simpan, dan aturan "perlu dicek".
import type { SupabaseClient } from '@supabase/supabase-js';

export type Item = { id: string; name: string; qty: number; unit_price: number | null; line_total: number };
export type ItemInput = { name: string; qty: number; unit_price: number };
export type Draft = { key: string; name: string; qty: string; price: number };

export const MAX_ITEMS = 200;

/** Aturan yang sama dengan Edge Function `ocr`: selisih > max(Rp1.000, 1% total). */
export const itemsOff = (sum: number, total: number, count: number) =>
  count > 0 && Math.abs(sum - total) > Math.max(1000, total * 0.01);

export const lineTotal = (qty: number, price: number) => Math.round(qty * price);

/** "1,5" dan "1.5" sama-sama terbaca; selain angka -> NaN. */
export const parseQty = (s: string) => (/^\d+([.,]\d{1,3})?$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : NaN);

export const toDrafts = (items: Item[]): Draft[] =>
  items.map((i) => ({ key: i.id, name: i.name, qty: String(i.qty).replace('.', ','), price: i.unit_price ?? 0 }));

export const blankDraft = (): Draft => ({ key: crypto.randomUUID(), name: '', qty: '1', price: 0 });

const untouched = (d: Draft) => !d.name.trim() && d.price === 0 && (d.qty.trim() === '' || d.qty.trim() === '1');

/** Baris yang belum disentuh dibuang; sisanya divalidasi. `errors` berkunci Draft.key. */
export function cleanDrafts(drafts: Draft[]): { items: ItemInput[]; errors: Record<string, string> } {
  const items: ItemInput[] = [];
  const errors: Record<string, string> = {};
  for (const d of drafts) {
    if (untouched(d)) continue;
    const qty = parseQty(d.qty);
    if (!d.name.trim()) errors[d.key] = 'Isi nama item.';
    else if (!(qty > 0)) errors[d.key] = 'Qty harus angka lebih dari 0.';
    else if (!Number.isSafeInteger(lineTotal(qty, d.price))) errors[d.key] = 'Angkanya terlalu besar.';
    else items.push({ name: d.name.trim(), qty, unit_price: d.price });
  }
  return { items, errors };
}

export const draftSum = (drafts: Draft[]) =>
  cleanDrafts(drafts).items.reduce((s, i) => s + lineTotal(i.qty, i.unit_price), 0);

/**
 * Nominal pengeluaran manual mengikuti jumlah item selama masih kosong atau masih sama dengan jumlah item sebelumnya.
 * Jumlah item 0 (semua item dihapus) tidak mengosongkan nominal.
 */
export const autoAmount = (amount: number, prevSum: number, nextSum: number) =>
  nextSum > 0 && (amount === 0 || amount === prevSum) ? nextSum : amount;

export type ItemRow = ItemInput & { line_total: number };

/** Validasi sisi server. Satu item tidak sah -> null, tidak ada yang disimpan. */
export function itemRows(items: ItemInput[]): ItemRow[] | null {
  const rows: ItemRow[] = [];
  for (const i of items) {
    const name = String(i.name).trim().slice(0, 120);
    const line_total = lineTotal(i.qty, i.unit_price);
    if (!name || !(i.qty > 0) || !Number.isSafeInteger(i.unit_price) || i.unit_price < 0 || !Number.isSafeInteger(line_total))
      return null;
    rows.push({ name, qty: i.qty, unit_price: i.unit_price, line_total });
  }
  return rows;
}

/** Ganti semua item milik satu struk atau satu pengeluaran manual. false = gagal. */
export async function replaceItems(
  supabase: SupabaseClient,
  parent: { receipt_id: string } | { transaction_id: string },
  rows: ItemRow[],
): Promise<boolean> {
  const [col, id] = Object.entries(parent)[0];
  const old = await supabase.from('receipt_items').select('id').eq(col, id);
  if (old.error) return false;
  // ponytail: bukan satu transaksi. Sisip dulu baru hapus, jadi gagal di tengah tidak menghilangkan item lama
  // (paling buruk item dobel). Pindah ke RPC kalau dobel itu pernah terjadi.
  if (rows.length && (await supabase.from('receipt_items').insert(rows.map((r) => ({ ...r, ...parent })))).error) return false;
  if (old.data.length && (await supabase.from('receipt_items').delete().in('id', old.data.map((o) => o.id))).error) return false;
  return true;
}
