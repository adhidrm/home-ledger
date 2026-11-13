// Item struk: bentuk draf di form, validasi, dan aturan "perlu dicek".

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
