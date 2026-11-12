-- Schema v1: satu household, satu ledger default, RLS di semua tabel.
-- Uang = bigint rupiah. Tanggal transaksi = date di Asia/Jakarta.

create schema if not exists private;

create function private.today_jkt() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ---------------------------------------------------------------- household

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Rumah',
  -- 6 digit sesuai spec (CSPRNG). Entropi kecil: RPC join (tahap 2) wajib batasi percobaan.
  -- ponytail: collision = unique violation; retry di RPC kalau pernah terjadi
  invite_code text not null unique default lpad(
    (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  household_id uuid not null references public.households on delete cascade,
  display_name text,
  email text
);
create index on public.profiles (household_id);

create table public.ledgers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null default 'Utama',
  is_default boolean not null default false
);
create unique index ledgers_one_default on public.ledgers (household_id) where is_default;

-- Dipakai policy. security definer supaya tidak rekursif lewat RLS profiles.
create function private.my_household_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select household_id from public.profiles where id = auth.uid() $$;

create function private.my_ledger_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select l.id from public.ledgers l
  join public.profiles p on p.household_id = l.household_id
  where p.id = auth.uid()
$$;

-- ---------------------------------------------------------------- master data

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'ewallet', 'credit_card')),
  opening_balance bigint not null default 0,
  archived_at timestamptz,
  unique (id, ledger_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  name text not null,
  icon text,
  sort int not null default 0,
  archived_at timestamptz,
  unique (id, ledger_id)
);

-- ---------------------------------------------------------------- struk

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  storage_path text not null,
  ocr_raw text,
  status text not null default 'pending'
    check (status in ('pending', 'parsed', 'needs_check', 'failed')),
  parsed_total bigint,
  uploaded_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users on delete set null,
  unique (id, ledger_id)
);

create table public.receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts on delete cascade,
  name text not null,
  qty numeric(10, 3) not null default 1,
  unit_price bigint,
  line_total bigint not null
);
create index on public.receipt_items (receipt_id);

-- ---------------------------------------------------------------- transaksi

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  date date not null default private.today_jkt(),
  amount bigint not null check (amount > 0),
  account_id uuid not null,
  category_id uuid not null,
  merchant text,
  note text,
  source text not null default 'manual' check (source in ('manual', 'receipt', 'bill')),
  receipt_id uuid,
  bill_payment_id uuid,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- FK komposit: akun/kategori/struk wajib dari ledger yang sama
  foreign key (account_id, ledger_id) references public.accounts (id, ledger_id),
  foreign key (category_id, ledger_id) references public.categories (id, ledger_id),
  foreign key (receipt_id, ledger_id) references public.receipts (id, ledger_id)
    on delete set null (receipt_id)
);
create index on public.transactions (ledger_id, date desc);
create index on public.transactions (account_id);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger transactions_touch before update on public.transactions
  for each row execute function private.touch_updated_at();

create table public.account_adjustments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  delta bigint not null check (delta <> 0),
  note text not null check (length(trim(note)) > 0),
  date date not null default private.today_jkt(),
  created_by uuid default auth.uid() references auth.users on delete set null
);
create index on public.account_adjustments (account_id);

-- ---------------------------------------------------------------- tagihan

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  name text not null,
  category_id uuid not null,
  account_id uuid not null,
  nominal_expected bigint not null check (nominal_expected > 0),
  due_day smallint not null check (due_day between 1 and 31),
  active boolean not null default true,
  foreign key (account_id, ledger_id) references public.accounts (id, ledger_id),
  foreign key (category_id, ledger_id) references public.categories (id, ledger_id)
);

create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  amount bigint check (amount > 0),
  transaction_id uuid references public.transactions on delete set null,
  paid_at timestamptz,
  paid_by uuid references auth.users on delete set null,
  unique (bill_id, period)
);

alter table public.transactions
  add foreign key (bill_payment_id) references public.bill_payments on delete set null;

-- ---------------------------------------------------------------- budget

create table public.budget_caps (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  amount bigint not null check (amount >= 0),
  unique (ledger_id, period)
);

-- ---------------------------------------------------------------- AI / OCR

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null,
  base_url text not null,
  model text not null,
  json_mode boolean not null default true,
  temperature numeric(3, 2) not null default 0 check (temperature between 0 and 2),
  is_active boolean not null default false,
  key_hint text, -- contoh 'sk-…abcd'; bukan rahasia
  created_at timestamptz not null default now()
);
create unique index ai_providers_one_active on public.ai_providers (household_id) where is_active;

-- Ciphertext (AES-GCM, kunci AI_KEK di env Edge Function). Hanya service_role.
create table public.ai_credentials (
  provider_id uuid primary key references public.ai_providers on delete cascade,
  api_key text not null
);

-- ---------------------------------------------------------------- seed per household / ledger

create function private.seed_household() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.ledgers (household_id, name, is_default) values (new.id, 'Utama', true);
  -- tanpa key -> tidak aktif sampai user isi key dan "Jadikan utama"
  insert into public.ai_providers (household_id, name, base_url, model, json_mode)
  values (new.id, 'deepseek', 'https://api.deepseek.com', 'deepseek-flash', true);
  return new;
end $$;

create trigger households_seed after insert on public.households
  for each row execute function private.seed_household();

create function private.seed_ledger() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.categories (ledger_id, name, sort)
  select new.id, c.name, c.ord::int
  from unnest(array['Makan', 'Transport', 'Tagihan', 'Belanja', 'Kesehatan',
                    'Pendidikan', 'Hiburan', 'Cicilan', 'Lainnya'])
       with ordinality as c(name, ord);
  return new;
end $$;

create trigger ledgers_seed after insert on public.ledgers
  for each row execute function private.seed_ledger();

-- ---------------------------------------------------------------- RLS

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public;
grant execute on function private.my_household_id(), private.my_ledger_ids(),
  private.today_jkt() to authenticated;

alter table public.households          enable row level security;
alter table public.profiles            enable row level security;
alter table public.ledgers             enable row level security;
alter table public.accounts            enable row level security;
alter table public.categories          enable row level security;
alter table public.receipts            enable row level security;
alter table public.receipt_items       enable row level security;
alter table public.transactions        enable row level security;
alter table public.account_adjustments enable row level security;
alter table public.bills               enable row level security;
alter table public.bill_payments       enable row level security;
alter table public.budget_caps         enable row level security;
alter table public.ai_providers        enable row level security;
alter table public.ai_credentials      enable row level security;

-- Client hanya boleh ubah kolom nama; invite_code / household_id tidak bisa disentuh.
revoke update on public.households, public.profiles from anon, authenticated;
grant update (name) on public.households to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- ai_credentials: RLS aktif, TANPA policy, dan tanpa grant. Hanya service_role.
revoke all on public.ai_credentials from anon, authenticated;

create policy household_read on public.households for select to authenticated
  using (id = private.my_household_id());
create policy household_rename on public.households for update to authenticated
  using (id = private.my_household_id()) with check (id = private.my_household_id());

create policy profile_read on public.profiles for select to authenticated
  using (household_id = private.my_household_id());
create policy profile_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (household_id = private.my_household_id());

create policy ledger_read on public.ledgers for select to authenticated
  using (id in (select private.my_ledger_ids()));

-- Tabel ber-ledger_id: baca/tulis penuh di ledger milik household.
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'receipts', 'transactions',
                           'bills', 'budget_caps'] loop
    execute format(
      'create policy ledger_member on public.%I for all to authenticated
         using (ledger_id in (select private.my_ledger_ids()))
         with check (ledger_id in (select private.my_ledger_ids()))', t);
  end loop;
end $$;

create policy ledger_member on public.account_adjustments for all to authenticated
  using (exists (select 1 from public.accounts a where a.id = account_id))
  with check (exists (select 1 from public.accounts a where a.id = account_id));

create policy ledger_member on public.receipt_items for all to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_id))
  with check (exists (select 1 from public.receipts r where r.id = receipt_id));

create policy ledger_member on public.bill_payments for all to authenticated
  using (exists (select 1 from public.bills b where b.id = bill_id))
  with check (exists (select 1 from public.bills b where b.id = bill_id));

-- Tulis provider + key lewat Edge Function (service_role). Client: baca & hapus.
create policy provider_read on public.ai_providers for select to authenticated
  using (household_id = private.my_household_id());
create policy provider_delete on public.ai_providers for delete to authenticated
  using (household_id = private.my_household_id());

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 2097152, array['image/jpeg']);

-- Path wajib: {ledger_id}/{receipt_id}.jpg
create policy receipts_member on storage.objects for all to authenticated
  using (bucket_id = 'receipts'
         and (storage.foldername(name))[1] in (select id::text from private.my_ledger_ids() id))
  with check (bucket_id = 'receipts'
         and (storage.foldername(name))[1] in (select id::text from private.my_ledger_ids() id));
