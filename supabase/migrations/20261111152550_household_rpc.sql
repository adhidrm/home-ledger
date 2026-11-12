-- Onboarding: buat household baru atau gabung lewat kode undangan.
-- Error dikirim sebagai pesan kunci (already_member, household_full, too_many_attempts)
-- supaya UI bisa memetakan ke teks.

create table private.join_attempts (
  user_id uuid not null references auth.users on delete cascade,
  at timestamptz not null default now()
);
create index on private.join_attempts (user_id, at);

create function public.create_household(p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'already_member';
  end if;

  for i in 1..5 loop
    begin
      insert into public.households default values returning id into hid;
      exit;
    exception when unique_violation then
      if i = 5 then raise; end if; -- invite_code bentrok 5x berturut-turut
    end;
  end loop;

  insert into public.profiles (id, household_id, display_name, email)
  values (uid, hid, nullif(trim(p_display_name), ''), (select email from auth.users where id = uid));
  return hid;
end $$;

-- null = kode salah. Maks 5 percobaan salah per jam per user; household maks 2 orang.
create function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'already_member';
  end if;
  if (select count(*) from private.join_attempts
      where user_id = uid and at > now() - interval '1 hour') >= 5 then
    raise exception 'too_many_attempts';
  end if;

  select id into hid from public.households where invite_code = trim(p_code);
  if hid is null then
    insert into private.join_attempts (user_id) values (uid);
    return null;
  end if;
  if (select count(*) from public.profiles where household_id = hid) >= 2 then
    raise exception 'household_full';
  end if;

  insert into public.profiles (id, household_id, display_name, email)
  values (uid, hid, nullif(trim(p_display_name), ''), (select email from auth.users where id = uid));
  return hid;
end $$;

revoke execute on function public.create_household(text), public.join_household(text, text)
  from public, anon;
grant execute on function public.create_household(text), public.join_household(text, text)
  to authenticated;
