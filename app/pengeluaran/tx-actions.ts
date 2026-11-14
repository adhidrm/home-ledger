'use server';

import { revalidatePath } from 'next/cache';
import { itemRows, MAX_ITEMS, replaceItems, type ItemInput } from '@/lib/receipt-items';
import { requireLedger } from '@/lib/session';

export type TxInput = {
  id?: string;
  date: string;
  amount: number;
  accountId: string;
  categoryId: string;
  merchant: string;
  note: string;
  receiptId?: string; // catat dari struk
  items?: ItemInput[]; // pengeluaran manual saja; tidak dikirim = item tidak disentuh
  force?: boolean; // user sudah melihat hint duplikat dan tetap menyimpan
};
export type TxResult = { error?: string; similar?: number };

export async function saveTx(input: TxInput): Promise<TxResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return { error: 'Isi jumlah pengeluaran.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Tanggal tidak valid.' };
  if (!input.accountId) return { error: 'Pilih akun.' };
  if (!input.categoryId) return { error: 'Pilih kategori.' };
  if (input.items && input.items.length > MAX_ITEMS) return { error: 'Terlalu banyak item.' };
  const rows = input.items && itemRows(input.items);
  if (rows === null) return { error: 'Periksa lagi isi item.' };
  const merchant = input.merchant.trim() || null;
  const { supabase, ledgerId } = await requireLedger();

  // §8: duplikat tidak dicegah, hanya diberi tahu sekali.
  if (!input.force && merchant) {
    let q = supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('date', input.date)
      .eq('amount', input.amount)
      .ilike('merchant', merchant.replace(/[%_\\]/g, '\\$&'));
    if (input.id) q = q.neq('id', input.id);
    const { count } = await q;
    if (count) return { similar: count };
  }

  const row = {
    date: input.date,
    amount: input.amount,
    account_id: input.accountId,
    category_id: input.categoryId,
    merchant,
    note: input.note.trim() || null,
  };
  const saved = await (input.id
    ? supabase.from('transactions').update(row).eq('id', input.id)
    : supabase.from('transactions').insert({
        ...row,
        ledger_id: ledgerId,
        ...(input.receiptId ? { source: 'receipt', receipt_id: input.receiptId } : { source: 'manual' }),
      })
  ).select('id, source').maybeSingle();
  if (saved.error || !saved.data) return { error: 'Gagal menyimpan. Coba lagi.' };

  // Item hanya untuk pengeluaran manual; item struk dikelola di halaman struk.
  const itemsOk = !rows || saved.data.source !== 'manual' || (await replaceItems(supabase, { transaction_id: saved.data.id }, rows));
  // Catatan baru dibatalkan supaya "Simpan" berikutnya tidak membuat pengeluaran dobel.
  if (!itemsOk && !input.id) await supabase.from('transactions').delete().eq('id', saved.data.id);

  revalidatePath('/');
  revalidatePath('/pengeluaran');
  revalidatePath('/akun');
  if (itemsOk) return {};
  return { error: input.id ? 'Pengeluaran tersimpan, tetapi item gagal disimpan. Coba simpan lagi.' : 'Gagal menyimpan. Coba lagi.' };
}

export async function deleteTx(id: string): Promise<TxResult> {
  const { supabase } = await requireLedger();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { error: 'Gagal menghapus. Coba lagi.' };
  revalidatePath('/');
  revalidatePath('/pengeluaran');
  revalidatePath('/akun');
  return {};
}
