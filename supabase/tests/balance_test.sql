-- Saldo akun = opening + Σ adjustment + Σ delta(tx). Smoke test §9 no. 7.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'e1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'f1@test.local', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select public.create_household('E');
select set_config('t.l', (select id::text from ledgers), true);
select set_config('t.c', (select id::text from categories limit 1), true);

insert into accounts (id, ledger_id, name, type, opening_balance) values
  ('20000000-0000-0000-0000-000000000001', current_setting('t.l')::uuid, 'Dompet', 'cash', 500000),
  ('20000000-0000-0000-0000-000000000002', current_setting('t.l')::uuid, 'Kartu', 'credit_card', 0);
insert into account_adjustments (account_id, delta, note)
  values ('20000000-0000-0000-0000-000000000001', -2000, 'selisih hitung');
insert into transactions (ledger_id, amount, account_id, category_id) values
  (current_setting('t.l')::uuid, 25000,  '20000000-0000-0000-0000-000000000001', current_setting('t.c')::uuid),
  (current_setting('t.l')::uuid, 310000, '20000000-0000-0000-0000-000000000001', current_setting('t.c')::uuid),
  (current_setting('t.l')::uuid, 100000, '20000000-0000-0000-0000-000000000002', current_setting('t.c')::uuid);

select is((select balance from account_balances where name = 'Dompet'), 163000::numeric,
  'cash: 500.000 - 2.000 - 25.000 - 310.000 = 163.000');
select is((select balance from account_balances where name = 'Kartu'), 100000::numeric,
  'kartu kredit: belanja 100.000 = utang 100.000');
select is((select opening_balance from accounts where name = 'Dompet'), 500000::bigint,
  'penyesuaian tidak menimpa saldo awal');
select throws_ok($$insert into account_adjustments (account_id, delta, note)
  values ('20000000-0000-0000-0000-000000000001', 1000, '  ')$$, '23514', null, 'penyesuaian wajib ada alasan');

insert into incomes (ledger_id, amount, account_id, source)
  values (current_setting('t.l')::uuid, 1000000, '20000000-0000-0000-0000-000000000001', 'Gaji');
select is((select balance from account_balances where name = 'Dompet'), 1163000::numeric,
  'pemasukan menambah saldo: 163.000 + 1.000.000 = 1.163.000');
select throws_ok(format($$insert into incomes (ledger_id, amount, account_id, source)
  values (%L, 1000, '20000000-0000-0000-0000-000000000001', ' ')$$, current_setting('t.l')),
  '23514', null, 'pemasukan wajib ada sumber');
reset role;

-- Household lain tidak melihat saldo E; anon ditolak
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);
select is((select count(*) from account_balances), 0::bigint, 'F tidak melihat saldo E');
select is((select count(*) from incomes), 0::bigint, 'F tidak melihat pemasukan E');
reset role;
set local role anon;
select throws_ok('select * from account_balances', '42501', null, 'anon ditolak');
reset role;

select * from finish();
rollback;
