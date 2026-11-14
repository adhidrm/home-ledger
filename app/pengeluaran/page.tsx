import { Nav } from '@/components/nav';
import { nextMonthStart, todayJkt } from '@/lib/format';
import { requireLedger } from '@/lib/session';
import { TxScreen } from './tx-screen';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; akun?: string; kat?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const current = todayJkt().slice(0, 7);
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? '') && sp.m! <= current ? sp.m! : current;
  const { supabase } = await requireLedger();

  let q = supabase
    .from('transactions')
    .select('id, date, amount, account_id, category_id, merchant, note, source, receipt_id, receipts(status), receipt_items(id, name, qty, unit_price, line_total)')
    .gte('date', `${ym}-01`)
    .lt('date', nextMonthStart(ym))
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (sp.akun) q = q.eq('account_id', sp.akun);
  if (sp.kat) q = q.eq('category_id', sp.kat);
  if (sp.q) q = q.ilike('merchant', `%${sp.q.replace(/[%_\\]/g, '\\$&')}%`);

  const [tx, accounts, categories] = await Promise.all([
    q,
    supabase.from('accounts').select('id, name, archived_at').order('name'),
    supabase.from('categories').select('id, name, archived_at').order('sort'),
  ]);

  return (
    <>
      <Nav current="/" />
      <TxScreen
        ym={ym}
        current={current}
        filters={{ akun: sp.akun ?? '', kat: sp.kat ?? '', q: sp.q ?? '' }}
        rows={(tx.data ?? []).map(({ receipts, receipt_items, ...r }) => ({
          ...r,
          items: receipt_items ?? [],
          // relasi many-to-one: runtime berupa objek, tipe tanpa skema menebak array
          needsCheck: (receipts as unknown as { status: string } | null)?.status === 'needs_check',
        }))}
        failed={Boolean(tx.error || accounts.error || categories.error)}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
      />
    </>
  );
}
