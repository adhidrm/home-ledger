import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// User + profil. Tanpa profil = belum punya rumah -> /mulai.
export async function requireProfile() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, household_id, display_name, email')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) redirect('/mulai');
  return { supabase, user: auth.user, profile };
}

// UI memakai satu ledger default (schema sudah siap multi-ledger, Q12a).
export async function requireLedger() {
  const ctx = await requireProfile();
  const { data, error } = await ctx.supabase.from('ledgers').select('id').eq('is_default', true).single();
  if (error) throw error;
  return { ...ctx, ledgerId: data.id as string };
}
