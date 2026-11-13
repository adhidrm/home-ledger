import { Nav } from '@/components/nav';
import { nextMonthStart, todayJkt } from '@/lib/format';
import { requireLedger } from '@/lib/session';
import { IncomeScreen } from './income-screen';

export default async function IncomePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const current = todayJkt().slice(0, 7);
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? '') && sp.m! <= current ? sp.m! : current;
  const { supabase } = await requireLedger();

  const [inc, accounts] = await Promise.all([
    supabase
      .from('incomes')
      .select('id, date, amount, account_id, source')
      .gte('date', `${ym}-01`)
      .lt('date', nextMonthStart(ym))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('accounts').select('id, name, type, archived_at').order('name'),
  ]);

  return (
    <>
      <Nav current="/" />
      <h1 className="sr-only">Pemasukan</h1>
      <IncomeScreen
        ym={ym}
        current={current}
        rows={inc.data ?? []}
        failed={Boolean(inc.error || accounts.error)}
        accounts={accounts.data ?? []}
        targets={(accounts.data ?? []).filter((a) => !a.archived_at && a.type !== 'credit_card')}
      />
    </>
  );
}
