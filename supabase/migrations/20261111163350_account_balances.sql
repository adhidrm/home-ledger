-- Saldo dihitung, tidak pernah disimpan (spec §3).
-- cash/bank/ewallet: transaksi mengurangi; credit_card: transaksi menambah utang.
create view public.account_balances with (security_invoker = true) as
select
  a.id, a.ledger_id, a.name, a.type, a.opening_balance, a.archived_at,
  a.opening_balance
    + coalesce((select sum(d.delta) from public.account_adjustments d where d.account_id = a.id), 0)
    + coalesce((select sum(case when a.type = 'credit_card' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0) as balance
from public.accounts a;

revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;
