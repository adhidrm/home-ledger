'use server';

import { revalidatePath } from 'next/cache';
import { itemRows, itemsOff, MAX_ITEMS, replaceItems, type ItemInput } from '@/lib/receipt-items';
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
  const rows = itemRows(items);
  if (!rows) return { error: 'Periksa lagi isi item.' };
  const { supabase } = await requireLedger();
  if (!(await replaceItems(supabase, { receipt_id: receiptId }, rows))) return { error: 'Item gagal disimpan. Coba lagi.' };

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
