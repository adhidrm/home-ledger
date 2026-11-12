-- Onboarding RPC: create_household / join_household. Semua di-rollback.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'd1@test.local', 'authenticated', 'authenticated');

-- anon
set local role anon;
select throws_ok($$select public.create_household('x')$$, '42501', null, 'anon tidak bisa create_household');
select throws_ok($$select public.join_household('123456', 'x')$$, '42501', null, 'anon tidak bisa join_household');
reset role;

-- A membuat household
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select isnt(public.create_household('  Adhi '), null, 'A membuat household');
select is((select display_name from profiles), 'Adhi', 'nama di-trim');
select is((select email from profiles), 'a1@test.local', 'email diambil dari auth.users');
select is((select count(*) from ledgers where is_default), 1::bigint, 'ledger default dibuat');
select is((select count(*) from categories), 9::bigint, '9 kategori seed');
select is((select count(*) from ai_providers where not is_active), 1::bigint, 'provider deepseek seed, belum aktif');
select matches((select invite_code from households), '^\d{6}$', 'invite_code 6 digit');
select throws_ok($$select public.create_household('lagi')$$, 'P0001', 'already_member', 'A tidak bisa membuat household kedua');
select set_config('t.code', (select invite_code from households), true);
select set_config('t.hid', (select id::text from households), true);
reset role;

-- B salah kode 5x, percobaan ke-6 diblokir walau kodenya benar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(
  (select count(*) from generate_series(1, 5) g
   where public.join_household(case when current_setting('t.code') = '000000' then '999999' else '000000' end, 'B') is null),
  5::bigint, 'B: 5 kode salah mengembalikan null');
select throws_ok(format($$select public.join_household(%L, 'B')$$, current_setting('t.code')),
  'P0001', 'too_many_attempts', 'B: percobaan ke-6 diblokir');
reset role;

-- C gabung dengan kode benar
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.join_household(' ' || current_setting('t.code') || ' ', 'Istri')::text,
  current_setting('t.hid'), 'C gabung ke household A');
select is((select count(*) from profiles), 2::bigint, 'C melihat 2 anggota');
reset role;

-- D: household sudah 2 orang
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(format($$select public.join_household(%L, 'D')$$, current_setting('t.code')),
  'P0001', 'household_full', 'D ditolak: household penuh');
reset role;

select * from finish();
rollback;
