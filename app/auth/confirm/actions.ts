'use server';

import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function confirmLogin(form: FormData) {
  const token_hash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '') as EmailOtpType;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  redirect(error ? '/login?error=link' : '/');
}
