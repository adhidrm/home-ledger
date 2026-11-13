'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { rp } from '@/lib/format';
import {
  blankDraft, cleanDrafts, draftSum, itemsOff, lineTotal, MAX_ITEMS, parseQty, toDrafts,
  type Draft, type Item,
} from '@/lib/receipt-items';
import { saveReceiptItems } from '../actions';

function Sum({ sum, total, count }: { sum: number; total: number; count: number }) {
  return (
    <>
      <div className="item-sum"><span>Jumlah item</span><span>{rp(sum)}</span></div>
      {itemsOff(sum, total, count) && (
        <div className="item-sum warn" role="status">
          <span>{sum > total ? 'Lebih dari total' : 'Kurang dari total'}</span>
          <span>{rp(sum - total)}</span>
        </div>
      )}
    </>
  );
}

export function ItemEditor({ drafts, onChange, errors, total }: {
  drafts: Draft[];
  onChange: (d: Draft[]) => void;
  errors: Record<string, string>;
  total: number;
}) {
  const set = (key: string, patch: Partial<Draft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  return (
    <>
      {drafts.map((d, n) => {
        const qty = parseQty(d.qty);
        return (
          <fieldset className="item-edit" key={d.key}>
            <legend className="sr-only">Item {n + 1}</legend>
            <label className="ifield wide">
              <span className="flabel">Nama</span>
              <input className="input" value={d.name} onChange={(e) => set(d.key, { name: e.target.value })} maxLength={120} autoComplete="off" />
            </label>
            <button type="button" className="textbtn danger" onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}>
              Hapus<span className="sr-only"> item {n + 1}</span>
            </button>
            <label className="ifield">
              <span className="flabel">Qty</span>
              <input className="input" value={d.qty} onChange={(e) => set(d.key, { qty: e.target.value })} inputMode="decimal" maxLength={10} autoComplete="off" />
            </label>
            <label className="ifield">
              <span className="flabel">Harga satuan</span>
              <MoneyInput value={d.price} onChange={(price) => set(d.key, { price })} />
            </label>
            <span className="item-total">{qty > 0 ? rp(lineTotal(qty, d.price)) : ''}</span>
            {errors[d.key] && <p className="errline wide3" role="alert">{errors[d.key]}</p>}
          </fieldset>
        );
      })}
      {drafts.length < MAX_ITEMS && (
        <button type="button" className="row actbtn" onClick={() => onChange([...drafts, blankDraft()])}>Tambah item</button>
      )}
      <Sum sum={draftSum(drafts)} total={total} count={cleanDrafts(drafts).items.length} />
    </>
  );
}

/** Struk yang sudah dicatat: item hanya-baca, "Ubah item" membuka editor. Jumlah transaksi tidak ikut berubah. */
export function RecordedItems({ receiptId, items, total }: { receiptId: string; items: Item[]; total: number }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!drafts)
    return (
      <>
        <h2 className="section">Item ({items.length})</h2>
        {items.length === 0 ? (
          <p className="note">Belum ada item di struk ini.</p>
        ) : (
          <>
            {items.map((it) => (
              <div className="item" key={it.id}>
                <span className="row-main">
                  <span className="item-name">{it.name}</span>
                  <span className="item-qty">{String(it.qty).replace('.', ',')} x {rp(it.unit_price ?? 0)}</span>
                </span>
                <span className="amt">{rp(it.line_total)}</span>
              </div>
            ))}
            <Sum sum={items.reduce((s, i) => s + i.line_total, 0)} total={total} count={items.length} />
          </>
        )}
        <button className="row actbtn" onClick={() => { setErrors({}); setError(''); setDrafts(toDrafts(items)); }}>
          {items.length ? 'Ubah item' : 'Tambah item'}
        </button>
      </>
    );

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const c = cleanDrafts(drafts);
        setErrors(c.errors);
        if (Object.keys(c.errors).length) return;
        setPending(true);
        setError('');
        const r = await saveReceiptItems(receiptId, c.items, total);
        setPending(false);
        if (r.error) return setError(r.error);
        setDrafts(null);
        router.refresh();
      }}
    >
      <h2 className="section">Ubah item</h2>
      <ItemEditor drafts={drafts} onChange={setDrafts} errors={errors} total={total} />
      <div className="spacer" />
      <div className="bottom foot-btns">
        {error && <p className="errline" role="alert">{error}</p>}
        <button type="button" className="hair" disabled={pending} onClick={() => setDrafts(null)}>Batal</button>
        <button className="primary" disabled={pending}>{pending ? 'Menyimpan…' : 'Simpan item'}</button>
      </div>
    </form>
  );
}
