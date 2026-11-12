'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type LinkState = { sentTo?: string; error?: string; email?: string };

export async function sendLink(_: LinkState, form: FormData): Promise<LinkState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!email) return { error: 'Isi email dulu.' };

  const origin = (await headers()).get('origin');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Signup ditutup: hanya email yang sudah ditambahkan di Supabase yang bisa masuk.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (!error) return { sentTo: email };
  if (error.code === 'otp_disabled' || error.code === 'user_not_found')
    return { email, error: 'Email ini belum didaftarkan untuk rumah ini.' };
  if (error.code === 'over_email_send_rate_limit')
    return { email, error: 'Link baru saja dikirim. Tunggu sebentar sebelum minta lagi.' };
  return { email, error: 'Link gagal dikirim. Coba lagi.' };
}
