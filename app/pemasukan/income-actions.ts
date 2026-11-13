'use server';

import { revalidatePath } from 'next/cache';
import { requireLedger } from '@/lib/session';

export type IncomeInput = { id?: string; date: string; amount: number; accountId: string; source: string };
export type IncomeResult = { error?: string };

const refresh = () => ['/', '/pemasukan', '/akun'].forEach((p) => revalidatePath(p));

export async function saveIncome(input: IncomeInput): Promise<IncomeResult> {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return { error: 'Isi jumlah pemasukan.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Tanggal tidak valid.' };
  const source = input.source.trim();
  if (!source) return { error: 'Isi sumber pemasukan.' };
  const { supabase, ledgerId } = await requireLedger();

  // Kartu kredit menyimpan utang, bukan uang: pemasukan tidak masuk ke sana.
  const { data: acc } = await supabase.from('accounts').select('type').eq('id', input.accountId).maybeSingle();
  if (!acc) return { error: 'Pilih akun tujuan.' };
  if (acc.type === 'credit_card') return { error: 'Pemasukan tidak bisa dicatat ke kartu kredit.' };

  const row = { date: input.date, amount: input.amount, account_id: input.accountId, source };
  const { error } = input.id
    ? await supabase.from('incomes').update(row).eq('id', input.id)
    : await supabase.from('incomes').insert({ ...row, ledger_id: ledgerId });
  if (error) return { error: 'Gagal menyimpan. Coba lagi.' };
  refresh();
  return {};
}

export async function deleteIncome(id: string): Promise<IncomeResult> {
  const { supabase } = await requireLedger();
  const { error } = await supabase.from('incomes').delete().eq('id', id);
  if (error) return { error: 'Gagal menghapus. Coba lagi.' };
  refresh();
  return {};
}
