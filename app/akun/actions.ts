'use server';

import { revalidatePath } from 'next/cache';
import { ACCOUNT_TYPES, type AccountType } from '@/lib/format';
import { requireLedger } from '@/lib/session';

export type Result = { error?: string };

export async function saveAccount(input: {
  id?: string;
  name: string;
  type: AccountType;
  opening: number;
}): Promise<Result> {
  const name = input.name.trim();
  if (!name) return { error: 'Isi nama akun.' };
  const { supabase, ledgerId } = await requireLedger();

  // Jenis dan saldo awal tidak bisa diubah setelah dibuat: mengubahnya akan
  // menulis ulang riwayat saldo. Koreksi lewat penyesuaian saldo (Q5b).
  if (input.id) {
    const { error } = await supabase.from('accounts').update({ name }).eq('id', input.id);
    if (error) return { error: 'Akun gagal disimpan. Coba lagi.' };
  } else {
    if (!(input.type in ACCOUNT_TYPES)) return { error: 'Pilih jenis akun.' };
    if (!Number.isSafeInteger(input.opening) || input.opening < 0) return { error: 'Saldo awal tidak valid.' };
    const { error } = await supabase
      .from('accounts')
      .insert({ ledger_id: ledgerId, name, type: input.type, opening_balance: input.opening });
    if (error) return { error: 'Akun gagal disimpan. Coba lagi.' };
  }
  revalidatePath('/akun');
  return {};
}

export async function adjustBalance(input: { accountId: string; actual: number; note: string }): Promise<Result> {
  const note = input.note.trim();
  if (!note) return { error: 'Tulis alasan penyesuaian.' };
  if (!Number.isSafeInteger(input.actual) || input.actual < 0) return { error: 'Saldo tidak valid.' };
  const { supabase } = await requireLedger();

  const { data: acc, error: readErr } = await supabase
    .from('account_balances')
    .select('balance')
    .eq('id', input.accountId)
    .single();
  if (readErr) return { error: 'Saldo gagal dibaca. Coba lagi.' };

  const delta = input.actual - Number(acc.balance);
  if (delta === 0) return { error: 'Saldo sudah sama, tidak ada yang perlu disesuaikan.' };

  const { error } = await supabase
    .from('account_adjustments')
    .insert({ account_id: input.accountId, delta, note });
  if (error) return { error: 'Penyesuaian gagal disimpan. Coba lagi.' };
  revalidatePath('/akun');
  return {};
}

export async function archiveAccount(id: string): Promise<Result> {
  const { supabase } = await requireLedger();
  const { error } = await supabase.from('accounts').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) return { error: 'Akun gagal diarsipkan. Coba lagi.' };
  revalidatePath('/akun');
  return {};
}
