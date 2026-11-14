-- Jalankan ke project cloud: npm run db:test
-- Fixture (household A dan B) dibuat di dalam transaksi ini lalu di-rollback.
begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

-- ------------------------------------------------ fixture
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@test.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@test.local', 'authenticated', 'authenticated');

insert into public.households (id, name, invite_code)
values ('10000000-0000-0000-0000-00000000000a', 'Rumah A', '111111'),
       ('10000000-0000-0000-0000-00000000000b', 'Rumah B', '222222');

insert into public.profiles (id, household_id, display_name, email)
values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'A', 'a@test.local'),
       ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'B', 'b@test.local');

do $$
declare
  h text; uid uuid; lid uuid; acc uuid; cat uuid; rid uuid; bid uuid; tid uuid; bpid uuid;
begin
  foreach h in array array['a', 'b'] loop
    uid := ('00000000-0000-0000-0000-00000000000' || h)::uuid;
    select id into lid from public.ledgers where household_id = ('10000000-0000-0000-0000-00000000000' || h)::uuid;
    select id into cat from public.categories where ledger_id = lid and name = 'Belanja';

    insert into public.accounts (ledger_id, name, type, opening_balance)
    values (lid, 'Dompet ' || h, 'cash', 500000) returning id into acc;
    insert into public.account_adjustments (account_id, delta, note, created_by)
    values (acc, -2000, 'koreksi', uid);
    insert into public.incomes (ledger_id, amount, account_id, source, created_by)
    values (lid, 1000000, acc, 'Gaji', uid);

    insert into public.receipts (ledger_id, storage_path, status, parsed_total, created_by)
    values (lid, lid || '/r.jpg', 'parsed', 25000, uid) returning id into rid;
    insert into public.receipt_items (receipt_id, name, qty, unit_price, line_total)
    values (rid, 'Beras', 1, 25000, 25000);

    insert into public.transactions (ledger_id, amount, account_id, category_id, merchant, source, receipt_id, created_by)
    values (lid, 25000, acc, cat, 'Warung', 'receipt', rid, uid);

    insert into public.bills (ledger_id, name, category_id, account_id, nominal_expected, due_day)
    values (lid, 'Listrik', cat, acc, 300000, 5) returning id into bid;
    insert into public.transactions (ledger_id, amount, account_id, category_id, merchant, source, created_by)
    values (lid, 310000, acc, cat, 'Listrik', 'bill', uid) returning id into tid;
    -- item yang menempel langsung ke pengeluaran, tanpa struk
    insert into public.receipt_items (transaction_id, name, qty, unit_price, line_total)
    values (tid, 'Token', 1, 310000, 310000);
    insert into public.bill_payments (bill_id, period, status, amount, transaction_id, paid_at, paid_by)
    values (bid, to_char(now(), 'YYYY-MM'), 'paid', 310000, tid, now(), uid) returning id into bpid;
    update public.transactions set bill_payment_id = bpid where id = tid;

    insert into public.budget_caps (ledger_id, period, amount)
    values (lid, to_char(now(), 'YYYY-MM'), 5000000);

    insert into public.ai_credentials (provider_id, api_key)
    select id, 'ciphertext-' || h from public.ai_providers
    where household_id = ('10000000-0000-0000-0000-00000000000' || h)::uuid;
  end loop;
end $$;

-- Tabel baru tanpa tes = gagal di sini.
select tables_are('public', array[
  'households', 'profiles', 'ledgers', 'accounts', 'categories', 'receipts',
  'receipt_items', 'transactions', 'account_adjustments', 'bills',
  'bill_payments', 'budget_caps', 'ai_providers', 'ai_credentials', 'incomes'
]);
select is((select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
          0::bigint, 'RLS aktif di semua tabel public');
select hasnt_column('public', 'ai_providers', 'api_key', 'ai_providers tanpa kolom secret');

select set_config('t.lb', (select id::text from ledgers
  where household_id = '10000000-0000-0000-0000-00000000000b'), true);
select set_config('t.la', (select id::text from ledgers
  where household_id = '10000000-0000-0000-0000-00000000000a'), true);
select set_config('t.acc_b', (select a.id::text from accounts a
  where a.ledger_id = current_setting('t.lb')::uuid), true);
select set_config('t.tx_b', (select t.id::text from transactions t
  where t.ledger_id = current_setting('t.lb')::uuid limit 1), true);
select set_config('t.cat_a', (select c.id::text from categories c
  where c.ledger_id = current_setting('t.la')::uuid limit 1), true);

-- ------------------------------------------------ anon, tanpa sesi: 0 baris
set local role anon;
select set_config('request.jwt.claims', '', true);

select is((select count(*) from households),          0::bigint, 'anon: households');
select is((select count(*) from profiles),            0::bigint, 'anon: profiles');
select is((select count(*) from ledgers),             0::bigint, 'anon: ledgers');
select is((select count(*) from accounts),            0::bigint, 'anon: accounts');
select is((select count(*) from categories),          0::bigint, 'anon: categories');
select is((select count(*) from receipts),            0::bigint, 'anon: receipts');
select is((select count(*) from receipt_items),       0::bigint, 'anon: receipt_items');
select is((select count(*) from transactions),        0::bigint, 'anon: transactions');
select is((select count(*) from account_adjustments), 0::bigint, 'anon: account_adjustments');
select is((select count(*) from incomes),             0::bigint, 'anon: incomes');
select is((select count(*) from bills),               0::bigint, 'anon: bills');
select is((select count(*) from bill_payments),       0::bigint, 'anon: bill_payments');
select is((select count(*) from budget_caps),         0::bigint, 'anon: budget_caps');
select is((select count(*) from ai_providers),        0::bigint, 'anon: ai_providers');
select throws_ok('select * from ai_credentials', '42501', null, 'anon: ai_credentials ditolak');

-- ------------------------------------------------ user A: hanya data household A
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*) from households),          1::bigint, 'A: households');
select is((select count(*) from profiles),            1::bigint, 'A: profiles');
select is((select count(*) from ledgers),             1::bigint, 'A: ledgers');
select is((select count(*) from categories),          9::bigint, 'A: 9 kategori seed');
select is((select count(*) from accounts),            1::bigint, 'A: accounts');
select is((select count(*) from account_adjustments), 1::bigint, 'A: account_adjustments');
select is((select count(*) from incomes),             1::bigint, 'A: incomes');
select is((select count(*) from receipts),            1::bigint, 'A: receipts');
select is((select count(*) from receipt_items),       2::bigint, 'A: receipt_items (struk + pengeluaran)');
select is((select count(*) from transactions),        2::bigint, 'A: transactions');
select is((select count(*) from bills),               1::bigint, 'A: bills');
select is((select count(*) from bill_payments),       1::bigint, 'A: bill_payments');
select is((select count(*) from budget_caps),         1::bigint, 'A: budget_caps');
select is((select count(*) from ai_providers),        1::bigint, 'A: ai_providers');
select throws_ok('select * from ai_credentials', '42501', null,
  'A login: ai_credentials tetap ditolak');

select throws_ok(format(
  $$insert into transactions (ledger_id, amount, account_id, category_id)
    values (%L, 1000, %L, %L)$$,
  current_setting('t.lb'), current_setting('t.acc_b'), current_setting('t.cat_a')),
  '42501', null, 'A tidak bisa menulis ke ledger B');

select throws_ok(format(
  $$insert into transactions (ledger_id, amount, account_id, category_id)
    values (%L, 1000, %L, %L)$$,
  current_setting('t.la'), current_setting('t.acc_b'), current_setting('t.cat_a')),
  '23503', null, 'A tidak bisa memakai akun milik B');

select throws_ok(format(
  $$insert into receipt_items (transaction_id, name, line_total) values (%L, 'x', 1000)$$,
  current_setting('t.tx_b')),
  '42501', null, 'A tidak bisa menambah item ke pengeluaran B');

select throws_ok(format(
  $$insert into incomes (ledger_id, amount, account_id, source) values (%L, 1000, %L, 'x')$$,
  current_setting('t.lb'), current_setting('t.acc_b')),
  '42501', null, 'A tidak bisa mencatat pemasukan ke ledger B');

select throws_ok(format(
  $$insert into storage.objects (bucket_id, name) values ('receipts', %L)$$,
  current_setting('t.lb') || '/x.jpg'),
  '42501', null, 'A tidak bisa upload ke folder ledger B');

select lives_ok(format(
  $$insert into storage.objects (bucket_id, name) values ('receipts', %L)$$,
  current_setting('t.la') || '/x.jpg'),
  'A bisa upload ke folder ledger sendiri');

select throws_ok($$update households set invite_code = '000000'$$, '42501', null,
  'A tidak bisa mengubah invite_code');

update households set name = 'diretas' where id = '10000000-0000-0000-0000-00000000000b';

-- ------------------------------------------------ service_role
reset role;
select is((select name from households where id = '10000000-0000-0000-0000-00000000000b'),
          'Rumah B', 'A tidak bisa rename household B');

set local role service_role;
select is((select count(*) from ai_credentials), 2::bigint, 'service_role bisa baca ai_credentials');
-- lewat service_role supaya yang menolak adalah constraint, bukan RLS
select throws_ok($$insert into receipt_items (name, line_total) values ('x', 1000)$$,
  '23514', null, 'item wajib punya tepat satu induk');

select * from finish();
rollback;
