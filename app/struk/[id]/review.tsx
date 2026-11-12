'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { rp, todayJkt } from '@/lib/format';
import type { Receipt } from '@/supabase/functions/_shared/ocr';
import { saveTx } from '../../pengeluaran/tx-actions';
import { scanReceipt } from '../actions';

type Named = { id: string; name: string };
type Item = { id: string; name: string; qty: number; unit_price: number | null; line_total: number };

export function ReceiptReview(props: {
  receipt: { id: string; status: string; raw: string | null; total: number | null };
  photoUrl: string | null;
  parsed: Receipt | null;
  items: Item[];
  accounts: Named[];
  categories: Named[];
  recorded: boolean;
}) {
  const { receipt, photoUrl, recorded } = props;
  const router = useRouter();
  const [scan, setScan] = useState<'idle' | 'running' | 'not_configured' | 'error'>(
    receipt.status === 'pending' && !recorded ? 'running' : 'idle',
  );
  const [scanError, setScanError] = useState('');
  const started = useRef(false);

  const run = async () => {
    setScan('running');
    const r = await scanReceipt(receipt.id);
    if (r.status === 'not_configured') return setScan('not_configured');
    if (r.error && !r.status) {
      setScanError(r.error);
      return setScan('error');
    }
    router.refresh(); // status baru (parsed / needs_check / failed) dibaca ulang dari server
  };

  useEffect(() => {
    if (scan === 'running' && !started.current) {
      started.current = true;
      run();
    }
  });

  const photo = (
    <div className="photo">
      {photoUrl ? <img src={photoUrl} alt="Foto struk" /> : <p className="note">Foto struk gagal dimuat.</p>}
    </div>
  );

  if (recorded)
    return (
      <>
        {photo}
        <p className="note">Struk ini sudah dicatat sebagai pengeluaran. <a href="/">Ke daftar pengeluaran</a></p>
      </>
    );

  if (scan === 'running')
    return (
      <>
        {photo}
        <p className="note" role="status">Membaca struk…</p>
        {[150, 110, 130].map((w) => (
          <div className="skel" key={w}><span className="bone" style={{ width: w }} /><span className="bone" style={{ width: 80 }} /></div>
        ))}
      </>
    );

  return (
    <>
      {photo}
      {scan === 'not_configured' && (
        <p className="note err" role="status">OCR belum dikonfigurasi. Isi manual di bawah, atau atur penyedia di <a href="/pengaturan">Pengaturan</a>.</p>
      )}
      {scan === 'error' && (
        <p className="note err" role="alert">
          {scanError} <button className="textbtn" onClick={() => { started.current = true; run(); }}>Coba lagi</button>
        </p>
      )}
      {receipt.status === 'failed' && scan === 'idle' && (
        <>
          <p className="note err" role="status">
            Struk tidak terbaca otomatis. Isi manual di bawah.{' '}
            <button className="textbtn" onClick={run}>Baca ulang</button>
          </p>
          {receipt.raw && <pre className="raw" style={{ margin: '0 16px 16px' }}>{receipt.raw}</pre>}
        </>
      )}
      <ReviewForm {...props} />
    </>
  );
}

function ReviewForm({ receipt, parsed, items, accounts, categories }: Parameters<typeof ReceiptReview>[0]) {
  const router = useRouter();
  const guess = parsed?.category_guess?.toLowerCase();
  const [amount, setAmount] = useState(receipt.total ?? 0);
  const [date, setDate] = useState(parsed?.date ?? todayJkt());
  const [merchant, setMerchant] = useState(parsed?.merchant ?? '');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState(categories.find((c) => c.name.toLowerCase() === guess)?.id ?? '');
  const [itemsOpen, setItemsOpen] = useState(false);
  const [similar, setSimilar] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let last = '';
    try { last = localStorage.getItem('last-account') ?? ''; } catch {}
    setAccountId(accounts.some((a) => a.id === last) ? last : accounts[0]?.id ?? '');
  }, [accounts]);
  useEffect(() => setSimilar(0), [amount, date, merchant]);

  const mismatch = receipt.status === 'needs_check';
  const itemsSum = items.reduce((s, i) => s + i.line_total, 0);
  const ready = amount > 0 && accountId && categoryId && date;

  if (accounts.length === 0)
    return <p className="note">Belum ada akun. <a href="/akun">Tambahkan akun dulu</a>, lalu buka struk ini lagi.</p>;

  return (
    <form
      className={mismatch ? 'form-warn' : undefined}
      style={{ marginTop: 16, borderTop: mismatch ? undefined : '1px solid var(--rule)' }}
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        const r = await saveTx({ amount, date, accountId, categoryId, merchant, note: '', receiptId: receipt.id, force: similar > 0 });
        setPending(false);
        if (r.similar) return setSimilar(r.similar);
        if (r.error) return setError(r.error);
        try { localStorage.setItem('last-account', accountId); } catch {}
        router.push('/');
      }}
    >
      <label className="field">
        <span className="flabel">Total</span>
        <MoneyInput value={amount} onChange={setAmount} big />
        {mismatch && <span className="warnline">Jumlah item tidak cocok dengan total struk. Total struk dipakai.</span>}
      </label>
      <label className="field">
        <span className="flabel">Merchant</span>
        <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={80} autoComplete="off" />
      </label>
      <label className="field">
        <span className="flabel">Tanggal</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="field">
        <span className="flabel">Akun</span>
        <span className="selwrap">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="caret" aria-hidden="true">▾</span>
        </span>
      </label>
      <label className="field">
        <span className="flabel">Kategori</span>
        <span className="selwrap">
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="" disabled>Pilih kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="caret" aria-hidden="true">▾</span>
        </span>
      </label>

      {receipt.status !== 'failed' && (
        <>
          <button type="button" className="disclosure" aria-expanded={itemsOpen} onClick={() => setItemsOpen(!itemsOpen)}>
            <span>Item ({items.length}){mismatch && <span className="badge"> · perlu dicek</span>}</span>
            <span className="disc-hint">{itemsOpen ? 'Sembunyikan' : 'Tampilkan'}</span>
          </button>
          {itemsOpen &&
            (items.length === 0 ? (
              <p className="note">Tidak ada item yang terbaca dari struk ini.</p>
            ) : (
              <>
                {items.map((it) => (
                  <div className="item" key={it.id}>
                    <span className="item-name">{it.name}</span>
                    <span className="item-qty">{it.qty} x {rp(it.unit_price ?? 0)}</span>
                  </div>
                ))}
                <div className="item-sum"><span>Jumlah item</span><span>{rp(itemsSum)}</span></div>
              </>
            ))}
        </>
      )}

      <div className="spacer" />
      <div className="bottom">
        {similar > 0 && (
          <p className="warnline" role="status" style={{ marginBottom: 12 }}>
            Sudah ada {similar} transaksi serupa di tanggal ini (merchant dan jumlah sama). Tetap simpan?
          </p>
        )}
        {error && <p className="errline" role="alert" style={{ marginBottom: 12 }}>{error}</p>}
        <button className="primary" disabled={!ready || pending}>
          {pending ? 'Menyimpan…' : similar > 0 ? 'Tetap simpan' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
