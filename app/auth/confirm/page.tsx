import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { confirmLogin } from './actions';
import { SubmitButton } from './submit';

// Token baru dipakai saat tombol ditekan (POST). Pemindai link di email dan
// prefetch browser hanya melakukan GET, jadi tidak menghabiskan token sekali pakai.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash, type } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect('/'); // link dibuka dua kali setelah berhasil masuk
  if (!token_hash || !type) redirect('/login?error=link');

  return (
    <>
      <header className="hero">
        <h1>Buku Belanja Rumah</h1>
        <p>Satu langkah lagi. Ketuk tombol di bawah untuk masuk di perangkat ini.</p>
      </header>
      <form action={confirmLogin} className="actions">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <SubmitButton />
      </form>
    </>
  );
}
