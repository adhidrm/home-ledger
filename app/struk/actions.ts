'use server';

import { revalidatePath } from 'next/cache';
import { itemsOff, lineTotal, MAX_ITEMS, type ItemInput } from '@/lib/receipt-items';
import { requireLedger } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

// Foto sudah diperkecil di browser (maks 1024px, JPEG q80) sebelum sampai sini.
export async function createReceipt(form: FormData): Promise<{ id?: string; error?: string }> {
  const photo = form.get('photo');
  if (!(photo instanceof Blob) || photo.type !== 'image/jpeg') return { error: 'Foto tidak terbaca. Coba foto lain.' };
  if (photo.size > 2 * 1024 * 1024) return { error: 'Foto terlalu besar.' };

  const { supabase, ledgerId } = await requireLedger();
  const id = crypto.randomUUID();
  const path = `${ledgerId}/${id}.jpg`;
  const up = await supabase.storage.from('receipts').upload(path, photo, { contentType: 'image/jpeg' });
  if (up.error) return { error: 'Foto gagal diunggah. Coba lagi.' };
  const { error } = await supabase.from('receipts').insert({ id, ledger_id: ledgerId, storage_path: path });
  if (error) return { error: 'Struk gagal disimpan. Coba lagi.' };
  return { id };
}

// Status akhir ditulis Edge Function; halaman cukup refresh.
export async function scanReceipt(id: string): Promise<{ status?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('ocr', { body: { action: 'scan', receipt_id: id } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    try { return (await ctx?.json()) ?? { error: 'Server OCR tidak menjawab.' }; } catch { return { error: 'Server OCR tidak menjawab.' }; }
  }
  return data;
}

// Dipakai layar review (sebelum dicatat) dan "Ubah item" (sesudah dicatat). `total` = angka pembanding untuk status.
export async function saveReceiptItems(receiptId: string, items: ItemInput[], total: number): Promise<{ error?: string }> {
  if (items.length > MAX_ITEMS) return { error: 'Terlalu banyak item.' };
  const rows = [];
  for (const i of items) {
    const name = String(i.name).trim().slice(0, 120);
    const line_total = lineTotal(i.qty, i.unit_price);
    if (!name || !(i.qty > 0) || !Number.isSafeInteger(i.unit_price) || i.unit_price < 0 || !Number.isSafeInteger(line_total))
      return { error: 'Periksa lagi isi item.' };
    rows.push({ receipt_id: receiptId, name, qty: i.qty, unit_price: i.unit_price, line_total });
  }
  const fail = { error: 'Item gagal disimpan. Coba lagi.' };
  const { supabase } = await requireLedger();
  const old = await supabase.from('receipt_items').select('id').eq('receipt_id', receiptId);
  if (old.error) return fail;
  // ponytail: bukan satu transaksi. Sisip dulu baru hapus, jadi gagal di tengah tidak menghilangkan item lama
  // (paling buruk item dobel). Pindah ke RPC kalau dobel itu pernah terjadi.
  if (rows.length && (await supabase.from('receipt_items').insert(rows)).error) return fail;
  if (old.data.length && (await supabase.from('receipt_items').delete().in('id', old.data.map((o) => o.id))).error) return fail;

  const sum = rows.reduce((s, r) => s + r.line_total, 0);
  await supabase
    .from('receipts')
    .update({ status: itemsOff(sum, total, rows.length) ? 'needs_check' : 'parsed' })
    .eq('id', receiptId)
    .in('status', ['parsed', 'needs_check']);
  revalidatePath(`/struk/${receiptId}`);
  revalidatePath('/pengeluaran');
  return {};
}
