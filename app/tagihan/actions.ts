'use server';

import { revalidatePath } from 'next/cache';
import { requireLedger } from '@/lib/session';

export type Result = { error?: string };

const done = (): Result => {
  revalidatePath('/tagihan');
  revalidatePath('/');
  revalidatePath('/pengeluaran');
  revalidatePath('/akun');
  return {};
};

export async function saveBill(input: {
  id?: string;
  name: string;
  amount: number;
  dueDay: number;
  accountId: string;
  categoryId: string;
}): Promise<Result> {
  const name = input.name.trim();
  if (!name) return { error: 'Isi nama tagihan.' };
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) return { error: 'Isi nominal perkiraan.' };
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return { error: 'Tanggal jatuh tempo 1 sampai 31.' };
  if (!input.accountId || !input.categoryId) return { error: 'Pilih akun dan kategori.' };
  const { supabase, ledgerId } = await requireLedger();
  const row = {
    name,
    nominal_expected: input.amount,
    due_day: input.dueDay,
    account_id: input.accountId,
    category_id: input.categoryId,
  };
  const { error } = input.id
    ? await supabase.from('bills').update(row).eq('id', input.id)
    : await supabase.from('bills').insert({ ...row, ledger_id: ledgerId });
  return error ? { error: 'Tagihan gagal disimpan. Coba lagi.' } : done();
}

export async function deleteBill(id: string): Promise<Result> {
  const { supabase } = await requireLedger();
  const { error } = await supabase.from('bills').delete().eq('id', id);
  return error ? { error: 'Tagihan gagal dihapus. Coba lagi.' } : done();
}

export async function payBill(billId: string, period: string, amount: number, date: string): Promise<Result> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return { error: 'Isi nominal yang dibayar.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Tanggal tidak valid.' };
  const { supabase } = await requireLedger();
  const { error } = await supabase.rpc('pay_bill', { p_bill_id: billId, p_period: period, p_amount: amount, p_date: date });
  if (error?.message.includes('already_paid')) return { error: 'Tagihan ini sudah ditandai lunas dari perangkat lain.' };
  return error ? { error: 'Gagal menandai lunas. Coba lagi.' } : done();
}

export async function unpayBill(paymentId: string): Promise<Result> {
  const { supabase } = await requireLedger();
  const { error } = await supabase.rpc('unpay_bill', { p_payment_id: paymentId });
  if (error?.message.includes('not_paid')) return { error: 'Tagihan ini sudah dibatalkan dari perangkat lain.' };
  return error ? { error: 'Gagal membatalkan. Coba lagi.' } : done();
}
