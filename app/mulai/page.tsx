import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StartForm } from './start-form';

export default async function StartPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', auth.user.id).maybeSingle();
  if (profile) redirect('/');

  return (
    <>
      <header className="hero">
        <h1>Satu buku untuk berdua</h1>
        <p>Catatan belanja ini dipakai bersama pasangan. Gabung ke rumah yang sudah ada, atau buat yang baru.</p>
      </header>
      <StartForm />
    </>
  );
}
