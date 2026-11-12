import { Nav } from '@/components/nav';
import { nextMonthStart, todayJkt } from '@/lib/format';
import { requireLedger } from '@/lib/session';
import { Dashboard } from './dashboard';

export default async function Home({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const current = todayJkt().slice(0, 7);
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? '') && sp.m! <= current ? sp.m! : current;
  const { supabase } = await requireLedger();

  const [tx, cap, lastCap, bills, paid, balances, accounts, categories] = await Promise.all([
    supabase.from('transactions').select('amount, category_id').gte('date', `${ym}-01`).lt('date', nextMonthStart(ym)),
    supabase.from('budget_caps').select('amount').eq('period', ym).maybeSingle(),
    supabase.from('budget_caps').select('amount').lt('period', ym).order('period', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('bills').select('id, nominal_expected').eq('active', true),
    supabase.from('bill_payments').select('bill_id').eq('period', ym).eq('status', 'paid'),
    supabase.from('account_balances').select('id, name, type, balance').is('archived_at', null).order('balance', { ascending: false }),
    supabase.from('accounts').select('id, name, archived_at').order('name'),
    supabase.from('categories').select('id, name, archived_at').order('sort'),
  ]);

  const failed = [tx, cap, bills, paid, balances, accounts, categories].some((r) => r.error);
  const rows = tx.data ?? [];
  const spent = rows.reduce((s, r) => s + r.amount, 0);

  // Top 5 kategori bulan ini.
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + r.amount);
  const topCats = [...byCat]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({ name: categories.data?.find((c) => c.id === id)?.name ?? 'Tanpa kategori', amount }));

  // Terutang = tagihan aktif yang belum lunas di bulan ini (tidak mengurangi pengeluaran).
  const paidIds = new Set((paid.data ?? []).map((p) => p.bill_id));
  const unpaid = (bills.data ?? []).filter((b) => !paidIds.has(b.id));

  return (
    <>
      <Nav current="/" />
      <h1 className="sr-only">Ringkasan</h1>
      <Dashboard
        ym={ym}
        current={current}
        failed={failed}
        spent={spent}
        cap={cap.data ? Number(cap.data.amount) : null}
        lastCap={lastCap.data ? Number(lastCap.data.amount) : 0}
        owed={unpaid.reduce((s, b) => s + Number(b.nominal_expected), 0)}
        owedCount={unpaid.length}
        balances={(balances.data ?? []).map((a) => ({ ...a, balance: Number(a.balance) }))}
        topCats={topCats}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
      />
    </>
  );
}
