import { Nav } from '@/components/nav';
import { todayJkt } from '@/lib/format';
import { requireLedger } from '@/lib/session';
import { BillsScreen } from './bills-screen';

export default async function BillsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const current = todayJkt().slice(0, 7);
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m ?? '') ? sp.m! : current;
  const { supabase } = await requireLedger();

  const [bills, payments, accounts, categories] = await Promise.all([
    supabase.from('bills').select('id, name, nominal_expected, due_day, account_id, category_id').eq('active', true).order('due_day').order('name'),
    supabase.from('bill_payments').select('id, bill_id, status, amount').eq('period', ym),
    supabase.from('accounts').select('id, name, archived_at').order('name'),
    supabase.from('categories').select('id, name, archived_at').order('sort'),
  ]);

  return (
    <>
      <Nav current="/tagihan" />
      <h1 className="sr-only">Tagihan</h1>
      <BillsScreen
        ym={ym}
        current={current}
        failed={Boolean(bills.error || payments.error || accounts.error || categories.error)}
        bills={(bills.data ?? []).map((b) => {
          const p = payments.data?.find((x) => x.bill_id === b.id && x.status === 'paid');
          return { ...b, payment: p ? { id: p.id, amount: Number(p.amount) } : null };
        })}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
      />
    </>
  );
}
