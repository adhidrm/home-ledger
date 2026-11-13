'use server';

import { revalidatePath } from 'next/cache';
import { receiptFiles } from '@/lib/receipt-files';
import { requireLedger, requireProfile } from '@/lib/session';

type ExportFile = { name: string; mime: string; content: string };

// Kutip semua sel; sel teks yang diawali = + - @ diberi ' supaya tidak dijalankan sebagai rumus di spreadsheet.
const cell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const csv = (head: string[], rows: unknown[][]) =>
  [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

/** Isi ekspor (spec §4): satu JSON lengkap + CSV per tabel. Nama file tetap. */
export async function exportData(): Promise<{ files?: ExportFile[]; error?: string }> {
  const { supabase } = await requireLedger();
  const [tx, inc, acc, bal, cat, adj, bills, pays, caps, rcp, items] = await Promise.all([
    supabase.from('transactions').select('*').order('date'),
    supabase.from('incomes').select('*').order('date'),
    supabase.from('accounts').select('*').order('name'),
    supabase.from('account_balances').select('id, balance'),
    supabase.from('categories').select('*').order('sort'),
    supabase.from('account_adjustments').select('*').order('date'),
    supabase.from('bills').select('*').order('name'),
    supabase.from('bill_payments').select('*').order('period'),
    supabase.from('budget_caps').select('*').order('period'),
    supabase.from('receipts').select('id, ledger_id, storage_path, status, parsed_total, uploaded_at'),
    supabase.from('receipt_items').select('*'),
  ]);
  if ([tx, inc, acc, bal, cat, adj, bills, pays, caps, rcp, items].some((r) => r.error)) return { error: 'Data gagal dibaca. Coba lagi.' };

  const name = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? '';
  const balance = (id: string) => bal.data!.find((b) => b.id === id)?.balance ?? '';
  const json = {
    exported_at: new Date().toISOString(),
    transactions: tx.data, incomes: inc.data, accounts: acc.data, categories: cat.data, account_adjustments: adj.data,
    bills: bills.data, bill_payments: pays.data, budget_caps: caps.data, receipts: rcp.data, receipt_items: items.data,
  };

  return {
    files: [
      { name: 'data.json', mime: 'application/json', content: JSON.stringify(json, null, 2) },
      {
        name: 'transaksi.csv', mime: 'text/csv',
        content: csv(['tanggal', 'jumlah', 'akun', 'kategori', 'merchant', 'catatan', 'sumber'],
          tx.data!.map((t) => [t.date, t.amount, name(acc.data!, t.account_id), name(cat.data!, t.category_id), t.merchant, t.note, t.source])),
      },
      {
        name: 'pemasukan.csv', mime: 'text/csv',
        content: csv(['tanggal', 'jumlah', 'akun', 'sumber'],
          inc.data!.map((i) => [i.date, i.amount, name(acc.data!, i.account_id), i.source])),
      },
      {
        name: 'akun.csv', mime: 'text/csv',
        content: csv(['nama', 'jenis', 'saldo_awal', 'saldo', 'diarsipkan'],
          acc.data!.map((a) => [a.name, a.type, a.opening_balance, balance(a.id), a.archived_at ? 'ya' : ''])),
      },
      {
        name: 'kategori.csv', mime: 'text/csv',
        content: csv(['nama', 'diarsipkan'], cat.data!.map((c) => [c.name, c.archived_at ? 'ya' : ''])),
      },
      {
        name: 'tagihan.csv', mime: 'text/csv',
        content: csv(['nama', 'nominal_perkiraan', 'jatuh_tempo', 'akun', 'kategori', 'aktif'],
          bills.data!.map((b) => [b.name, b.nominal_expected, b.due_day, name(acc.data!, b.account_id), name(cat.data!, b.category_id), b.active ? 'ya' : ''])),
      },
      {
        name: 'budget.csv', mime: 'text/csv',
        content: csv(['periode', 'batas'], caps.data!.map((c) => [c.period, c.amount])),
      },
    ],
  };
}

export async function markExported(folderId: string) {
  if (!/^[\w-]{10,100}$/.test(folderId)) return { error: 'ID folder tidak valid.' };
  const { supabase, profile } = await requireProfile();
  const { error } = await supabase
    .from('households')
    .update({ drive_folder_id: folderId, last_export_at: new Date().toISOString() })
    .eq('id', profile.household_id);
  revalidatePath('/pengaturan');
  return { error: error ? 'Waktu ekspor gagal dicatat.' : undefined };
}

export async function listReceiptFiles(ym: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return { error: true, files: [] as string[] };
  const { supabase } = await requireLedger();
  const r = await receiptFiles(supabase, ym);
  return { error: r.error, files: r.files.map((f) => f.name) };
}
