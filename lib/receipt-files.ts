import type { SupabaseClient } from '@supabase/supabase-js';
import { nextMonthStart } from './format';

const jktDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso));
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'struk';

/** Foto struk yang diunggah di bulan `ym` (Asia/Jakarta), dengan nama file yang mudah dibaca. */
export async function receiptFiles(supabase: SupabaseClient, ym: string) {
  const { data, error } = await supabase
    .from('receipts')
    .select('storage_path, uploaded_at, transactions(date, merchant)')
    .gte('uploaded_at', `${ym}-01T00:00:00+07:00`)
    .lt('uploaded_at', `${nextMonthStart(ym)}T00:00:00+07:00`)
    .order('uploaded_at');
  if (error) return { error: true as const, files: [] };

  const used = new Map<string, number>();
  const files = data.map((r) => {
    const tx = (r.transactions as { date: string; merchant: string | null }[])[0];
    const base = `struk-${tx?.date ?? jktDate(r.uploaded_at)}-${slug(tx?.merchant ?? 'struk')}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return { path: r.storage_path as string, name: `${base}${n > 1 ? `-${n}` : ''}.jpg` };
  });
  return { error: false as const, files };
}
