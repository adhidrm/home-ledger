import { Nav } from '@/components/nav';
import { requireLedger } from '@/lib/session';
import { AccountsScreen } from './accounts-screen';

export default async function AccountsPage() {
  const { supabase } = await requireLedger();
  const { data, error } = await supabase
    .from('account_balances')
    .select('id, name, type, balance')
    .is('archived_at', null)
    .order('name');

  return (
    <>
      <Nav current="/akun" />
      {error ? (
        <p className="note err">
          Daftar akun gagal dimuat. <a href="/akun">Muat ulang</a>
        </p>
      ) : (
        <AccountsScreen accounts={(data ?? []).map((a) => ({ ...a, balance: Number(a.balance) }))} />
      )}
    </>
  );
}
