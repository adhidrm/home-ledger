'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type StartState = { error?: string };

const MESSAGES: Record<string, string> = {
  too_many_attempts: 'Terlalu banyak kode salah. Coba lagi dalam 1 jam.',
  household_full: 'Rumah ini sudah berisi 2 orang.',
};

export async function startHousehold(_: StartState, form: FormData): Promise<StartState> {
  const name = String(form.get('name') ?? '').trim();
  const code = String(form.get('code') ?? '').replace(/\D/g, '');
  const joining = form.get('intent') === 'join';
  if (!name) return { error: 'Isi nama kamu dulu.' };
  if (joining && code.length !== 6) return { error: 'Kode undangan terdiri dari 6 angka.' };

  const supabase = await createClient();
  const { data, error } = joining
    ? await supabase.rpc('join_household', { p_code: code, p_display_name: name })
    : await supabase.rpc('create_household', { p_display_name: name });

  if (error && error.message !== 'already_member')
    return { error: MESSAGES[error.message] ?? 'Gagal menyimpan. Coba lagi.' };
  if (!error && !data) return { error: 'Kode tidak cocok. Cek lagi 6 angkanya.' };
  redirect('/');
}
