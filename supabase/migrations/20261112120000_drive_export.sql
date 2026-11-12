-- Spec §4 Export: folderId Drive disimpan per household, plus waktu ekspor terakhir.
alter table public.households
  add column drive_folder_id text,
  add column last_export_at timestamptz;

-- Policy household_rename sudah membatasi ke household sendiri; buka dua kolom ini saja.
grant update (drive_folder_id, last_export_at) on public.households to authenticated;
