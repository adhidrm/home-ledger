'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Sheet } from '@/components/sheet';
import { dayLabel, rp, shiftYm, todayJkt, ymLabel } from '@/lib/format';
import { PhotoButton } from '../struk/photo-button';
import { deleteTx, saveTx } from './tx-actions';

export type Named = { id: string; name: string; archived_at: string | null };
type Row = {
  id: string;
  date: string;
  amount: number;
  account_id: string;
  category_id: string;
  merchant: string | null;
  note: string | null;
  source: string;
  receipt_id: string | null;
  needsCheck: boolean;
};
type Filters = { akun: string; kat: string; q: string };

const LAST_ACCOUNT = 'last-account';

export function TxScreen(props: {
  ym: string;
  current: string;
  filters: Filters;
  rows: Row[];
  failed: boolean;
  accounts: Named[];
  categories: Named[];
}) {
  const { ym, current, filters, rows, failed, accounts, categories } = props;
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState<Row | null>(null);
  const [form, setForm] = useState<Row | 'new' | null>(null);
  const [searchOpen, setSearchOpen] = useState(Boolean(filters.q));

  const nameOf = (list: Named[], id: string) => list.find((x) => x.id === id)?.name ?? '';
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const filtering = Boolean(filters.akun || filters.kat || filters.q);
  const href = (patch: Partial<Filters & { m: string }>) => {
    const p = new URLSearchParams({ m: ym, ...filters, ...patch });
    for (const [k, v] of [...p]) if (!v || (k === 'm' && v === current)) p.delete(k);
    const s = p.toString();
    return s ? `${path}?${s}` : path;
  };
  const go = (patch: Partial<Filters>) => router.replace(href(patch), { scroll: false });

  return (
    <>
      <div className="band">
        <a className="arrow" href={href({ m: shiftYm(ym, -1) })} aria-label="Bulan sebelumnya">←</a>
        <span className="month-label">{ymLabel(ym)}</span>
        {ym < current ? (
          <a className="arrow" href={href({ m: shiftYm(ym, 1) })} aria-label="Bulan berikutnya">→</a>
        ) : (
          <span className="arrow" aria-hidden="true" />
        )}
        <span className="amt band-total">{rp(total)}</span>
      </div>

      <div className="filters">
        <label className="filter-wrap">
          <span className="sr-only">Filter akun</span>
          <select className={filters.akun ? 'filter on' : 'filter'} value={filters.akun} onChange={(e) => go({ akun: e.target.value })}>
            <option value="">Semua akun</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="filter-wrap">
          <span className="sr-only">Filter kategori</span>
          <select className={filters.kat ? 'filter on' : 'filter'} value={filters.kat} onChange={(e) => go({ kat: e.target.value })}>
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <button
          className={filters.q ? 'filter last on' : 'filter last'}
          aria-expanded={searchOpen}
          onClick={() => {
            if (searchOpen && filters.q) go({ q: '' });
            setSearchOpen(!searchOpen);
          }}
        >
          {searchOpen ? 'Tutup cari' : 'Cari'}
        </button>
      </div>
      {searchOpen && (
        <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q: String(new FormData(e.currentTarget).get('q') ?? '').trim() }); }}>
          <input className="search" type="search" name="q" defaultValue={filters.q} placeholder="Cari merchant, lalu Enter" aria-label="Cari merchant" autoFocus />
        </form>
      )}

      {failed ? (
        <p className="note err">Daftar pengeluaran gagal dimuat. <a href={href({})}>Coba lagi</a></p>
      ) : rows.length === 0 ? (
        <p className="note">
          {filtering
            ? 'Tidak ada pengeluaran yang cocok dengan filter ini.'
            : accounts.some((a) => !a.archived_at)
              ? `Belum ada pengeluaran di ${ymLabel(ym)}. Ketuk + Catat untuk mulai.`
              : <>Belum ada akun. <a href="/akun">Tambahkan akun dulu</a>, lalu catat pengeluaran di sini.</>}
        </p>
      ) : (
        rows.map((r) => (
          <button key={r.id} className="row" onClick={() => setMenu(r)}>
            <span className="row-main">
              <span className="t16">{r.merchant || nameOf(categories, r.category_id)}</span>
              <span className="meta">
                {nameOf(accounts, r.account_id)} · {nameOf(categories, r.category_id)} · {dayLabel(r.date)}
                {r.needsCheck && <span className="badge"> · perlu dicek</span>}
              </span>
            </span>
            <span className="amt">{rp(r.amount)}</span>
          </button>
        ))
      )}
      <div className="spacer" />

      <div className="bottom">
        <div className="foot-btns">
          <PhotoButton disabled={!accounts.some((a) => !a.archived_at)} />
          <button className="primary" onClick={() => setForm('new')} disabled={!accounts.some((a) => !a.archived_at)}>
            + Catat
          </button>
        </div>
      </div>

      <Sheet open={Boolean(menu)} onClose={() => setMenu(null)} label="Pilihan pengeluaran">
        {menu && (
          <TxMenu
            row={menu}
            meta={`${nameOf(accounts, menu.account_id)} · ${dayLabel(menu.date)}`}
            title={menu.merchant || nameOf(categories, menu.category_id)}
            onEdit={() => { setForm(menu); setMenu(null); }}
            onClose={() => setMenu(null)}
          />
        )}
      </Sheet>
      <Sheet open={Boolean(form)} onClose={() => setForm(null)} label={form === 'new' ? 'Catat pengeluaran' : 'Ubah pengeluaran'}>
        {form && (
          <TxForm
            row={form === 'new' ? null : form}
            accounts={accounts.filter((a) => !a.archived_at || (form !== 'new' && a.id === form.account_id))}
            categories={categories.filter((c) => !c.archived_at || (form !== 'new' && c.id === form.category_id))}
            onDone={() => setForm(null)}
          />
        )}
      </Sheet>
    </>
  );
}

function TxMenu({ row, title, meta, onEdit, onClose }: {
  row: Row; title: string; meta: string; onEdit: () => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const manual = row.source !== 'bill';
  return (
    <>
      <div className="row">
        <span className="row-main">
          <span className="t16">{title}</span>
          <span className="meta">{meta}</span>
        </span>
        <span className="amt">{rp(row.amount)}</span>
      </div>
      {row.note && <p className="note">{row.note}</p>}
      {manual && <button className="row actbtn" onClick={onEdit}>Ubah</button>}
      {row.receipt_id && <a className="row actbtn" href={`/struk/${row.receipt_id}`}>Lihat struk</a>}
      {manual ? (
        <button
          className="row actbtn danger"
          onClick={async () => {
            if (!confirm) return setConfirm(true);
            const r = await deleteTx(row.id);
            r.error ? setError(r.error) : onClose();
          }}
        >
          {confirm ? 'Ketuk lagi untuk menghapus' : 'Hapus'}
        </button>
      ) : (
        <p className="note">Pengeluaran dari tagihan diubah atau dihapus lewat halaman Tagihan (Batal lunas).</p>
      )}
      {error && <p className="note err" role="alert">{error}</p>}
      <button className="row actbtn quiet" onClick={onClose}>Batal</button>
    </>
  );
}

export function TxForm({ row, accounts, categories, onDone }: {
  row: Row | null; accounts: Named[]; categories: Named[]; onDone: () => void;
}) {
  const [amount, setAmount] = useState(row?.amount ?? 0);
  const [date, setDate] = useState(row?.date ?? todayJkt());
  const [accountId, setAccountId] = useState(row?.account_id ?? '');
  const [categoryId, setCategoryId] = useState(row?.category_id ?? '');
  const [merchant, setMerchant] = useState(row?.merchant ?? '');
  const [note, setNote] = useState(row?.note ?? '');
  const [similar, setSimilar] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // Akun terakhir dipakai di perangkat ini, supaya catat cepat (< 15 detik).
  useEffect(() => {
    if (row) return;
    let last = '';
    try { last = localStorage.getItem(LAST_ACCOUNT) ?? ''; } catch {}
    setAccountId(accounts.some((a) => a.id === last) ? last : accounts[0]?.id ?? '');
  }, [row, accounts]);

  // Data berubah setelah hint muncul -> hint tidak berlaku lagi.
  useEffect(() => setSimilar(0), [amount, date, merchant]);

  const ready = amount > 0 && accountId && categoryId && date;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        const r = await saveTx({ id: row?.id, amount, date, accountId, categoryId, merchant, note, force: similar > 0 });
        setPending(false);
        if (r.similar) return setSimilar(r.similar);
        if (r.error) return setError(r.error);
        try { localStorage.setItem(LAST_ACCOUNT, accountId); } catch {}
        onDone();
      }}
    >
      <div className="sheet-head">
        <h2 className="sheet-title">{row ? 'Ubah pengeluaran' : 'Catat pengeluaran'}</h2>
        <button type="button" className="textbtn pad" onClick={onDone}>Batal</button>
      </div>
      <label className="field">
        <span className="flabel">Jumlah</span>
        <MoneyInput value={amount} onChange={setAmount} big autoFocus={!row} />
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
      <label className="field">
        <span className="flabel">Merchant</span>
        <input className="input" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={80} placeholder="Misalnya Indomaret" autoComplete="off" />
      </label>
      <label className="field">
        <span className="flabel">Catatan</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Opsional" autoComplete="off" />
      </label>
      <div className="sheet-foot">
        {similar > 0 && (
          <p className="warnline" role="status">
            Sudah ada {similar} transaksi serupa di tanggal ini (merchant dan jumlah sama). Tetap simpan?
          </p>
        )}
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={!ready || pending}>
          {pending ? 'Menyimpan…' : similar > 0 ? 'Tetap simpan' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
