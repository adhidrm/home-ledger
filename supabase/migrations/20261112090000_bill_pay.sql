-- Tandai lunas / batal lunas secara atomik. security invoker: RLS tetap berlaku.
create or replace function public.pay_bill(p_bill_id uuid, p_period text, p_amount bigint, p_date date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  b public.bills;
  pay_id uuid;
  tx_id uuid;
begin
  select * into b from public.bills where id = p_bill_id;
  if not found then raise exception 'bill_not_found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'invalid_amount'; end if;

  insert into public.bill_payments (bill_id, period, status, amount, paid_at, paid_by)
  values (p_bill_id, p_period, 'paid', p_amount, now(), auth.uid())
  on conflict (bill_id, period) do update
    set status = 'paid', amount = excluded.amount, paid_at = now(), paid_by = auth.uid()
    where public.bill_payments.status = 'unpaid'
  returning id into pay_id;
  if pay_id is null then raise exception 'already_paid'; end if; -- device lain sudah menandai

  insert into public.transactions (ledger_id, date, amount, account_id, category_id, merchant, source, bill_payment_id)
  values (b.ledger_id, p_date, p_amount, b.account_id, b.category_id, b.name, 'bill', pay_id)
  returning id into tx_id;
  update public.bill_payments set transaction_id = tx_id where id = pay_id;
  return pay_id;
end $$;

create or replace function public.unpay_bill(p_payment_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Kunci baris dulu supaya dua device tidak membatalkan bersamaan.
  perform 1 from public.bill_payments where id = p_payment_id and status = 'paid' for update;
  if not found then raise exception 'not_paid'; end if;
  delete from public.transactions where bill_payment_id = p_payment_id;
  update public.bill_payments
     set status = 'unpaid', amount = null, paid_at = null, paid_by = null, transaction_id = null
   where id = p_payment_id;
end $$;

revoke execute on function public.pay_bill(uuid, text, bigint, date) from public, anon;
revoke execute on function public.unpay_bill(uuid) from public, anon;
grant execute on function public.pay_bill(uuid, text, bigint, date) to authenticated;
grant execute on function public.unpay_bill(uuid) to authenticated;
