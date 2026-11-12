'use server';

import { revalidatePath } from 'next/cache';
import { requireLedger } from '@/lib/session';

// Satu angka per bulan, input manual (spec §4 Budget). 0 = hapus batas.
export async function saveCap(period: string, amount: number): Promise<{ error?: string }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { error: 'Bulan tidak valid.' };
  if (!Number.isSafeInteger(amount) || amount < 0) return { error: 'Nominal tidak valid.' };
  const { supabase, ledgerId } = await requireLedger();
  const { error } = amount === 0
    ? await supabase.from('budget_caps').delete().eq('period', period)
    : await supabase.from('budget_caps').upsert({ ledger_id: ledgerId, period, amount }, { onConflict: 'ledger_id,period' });
  if (error) return { error: 'Batas gagal disimpan. Coba lagi.' };
  revalidatePath('/');
  return {};
}
