-- Item pembelian pada pengeluaran manual. Tabel item yang sama dipakai dua induk:
-- struk (receipt_id) atau pengeluaran manual (transaction_id), tepat salah satu.

alter table public.receipt_items
  alter column receipt_id drop not null,
  add column transaction_id uuid references public.transactions on delete cascade,
  add constraint receipt_items_one_parent check (num_nonnulls(receipt_id, transaction_id) = 1);
create index on public.receipt_items (transaction_id);

-- Subquery ikut RLS tabel induknya, jadi item hanya terlihat lewat struk/pengeluaran milik ledger sendiri.
drop policy ledger_member on public.receipt_items;
create policy ledger_member on public.receipt_items for all to authenticated
  using (exists (select 1 from public.receipts r where r.id = receipt_items.receipt_id)
      or exists (select 1 from public.transactions t where t.id = receipt_items.transaction_id))
  with check (exists (select 1 from public.receipts r where r.id = receipt_items.receipt_id)
           or exists (select 1 from public.transactions t where t.id = receipt_items.transaction_id));
