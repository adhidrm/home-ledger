import { notFound } from 'next/navigation';
import { Nav } from '@/components/nav';
import { requireLedger } from '@/lib/session';
import { extractJson, validate } from '@/supabase/functions/_shared/ocr';
import { ReceiptReview } from './review';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireLedger();
  const { data: rc } = await supabase
    .from('receipts')
    .select('id, storage_path, status, ocr_raw, parsed_total')
    .eq('id', id)
    .maybeSingle();
  if (!rc) notFound();

  const [photo, items, accounts, categories, tx] = await Promise.all([
    supabase.storage.from('receipts').createSignedUrl(rc.storage_path, 600),
    supabase.from('receipt_items').select('id, name, qty, unit_price, line_total').eq('receipt_id', id),
    supabase.from('accounts').select('id, name').is('archived_at', null).order('name'),
    supabase.from('categories').select('id, name').is('archived_at', null).order('sort'),
    supabase.from('transactions').select('id').eq('receipt_id', id).maybeSingle(),
  ]);

  // Prefill dibaca ulang dari jawaban mentah yang tersimpan (skema yang sama dengan Edge Function).
  const parsed = rc.status === 'parsed' || rc.status === 'needs_check' ? validate(extractJson(rc.ocr_raw ?? '')) : null;

  return (
    <>
      <Nav current="/" />
      <h1 className="sr-only">Review struk</h1>
      <ReceiptReview
        key={rc.status}
        receipt={{ id: rc.id, status: rc.status, raw: rc.ocr_raw, total: rc.parsed_total }}
        photoUrl={photo.data?.signedUrl ?? null}
        parsed={parsed}
        items={(items.data ?? []).map((i) => ({ ...i, qty: Number(i.qty) }))}
        accounts={accounts.data ?? []}
        categories={categories.data ?? []}
        recorded={Boolean(tx.data)}
      />
    </>
  );
}
