import { receiptFiles } from '@/lib/receipt-files';
import { requireLedger } from '@/lib/session';
import { zip } from '@/lib/zip';

// GET /struk/zip?m=YYYY-MM -> semua foto struk bulan itu dalam satu ZIP (spec §4 Export).
export async function GET(req: Request) {
  const ym = new URL(req.url).searchParams.get('m') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym)) return new Response('Bulan tidak valid.', { status: 400 });
  const { supabase } = await requireLedger();
  const { error, files } = await receiptFiles(supabase, ym);
  if (error) return new Response('Daftar foto gagal dimuat.', { status: 500 });
  if (files.length === 0) return new Response('Tidak ada foto struk di bulan ini.', { status: 404 });

  const entries = await Promise.all(
    files.map(async (f) => {
      const { data } = await supabase.storage.from('receipts').download(f.path);
      return data ? { name: f.name, data: new Uint8Array(await data.arrayBuffer()) } : null;
    }),
  );
  const body = zip(entries.filter((e) => e !== null));
  return new Response(body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="struk-${ym}.zip"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
