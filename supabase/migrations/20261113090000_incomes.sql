-- Pemasukan: uang masuk ke akun. Terpisah dari transactions (pengeluaran) dan
-- account_adjustments (koreksi saldo), supaya "Masuk" di Ringkasan tidak tercampur koreksi.
create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  date date not null default private.today_jkt(),
  amount bigint not null check (amount > 0),
  account_id uuid not null,
  source text not null check (length(trim(source)) > 0),
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  -- FK komposit: akun wajib dari ledger yang sama
  foreign key (account_id, ledger_id) references public.accounts (id, ledger_id)
);
create index on public.incomes (ledger_id, date desc);
create index on public.incomes (account_id);

alter table public.incomes enable row level security;
create policy ledger_member on public.incomes for all to authenticated
  using (ledger_id in (select private.my_ledger_ids()))
  with check (ledger_id in (select private.my_ledger_ids()));

-- Saldo = saldo awal + koreksi + pemasukan - pengeluaran.
-- Kartu kredit: UI menolak pemasukan ke kartu; kalau tetap ada baris, ia mengurangi utang.
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id, a.ledger_id, a.name, a.type, a.opening_balance, a.archived_at,
  a.opening_balance
    + coalesce((select sum(d.delta) from public.account_adjustments d where d.account_id = a.id), 0)
    + coalesce((select sum(case when a.type = 'credit_card' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id), 0)
    + coalesce((select sum(case when a.type = 'credit_card' then -i.amount else i.amount end)
                from public.incomes i where i.account_id = a.id), 0) as balance
from public.accounts a;
