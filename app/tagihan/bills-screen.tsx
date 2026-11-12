'use client';

import { useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Sheet } from '@/components/sheet';
import { rp, shiftYm, todayJkt, ymLabel } from '@/lib/format';
import { deleteBill, payBill, saveBill, unpayBill, type Result } from './actions';

type Named = { id: string; name: string; archived_at: string | null };
type Bill = {
  id: string;
  name: string;
  nominal_expected: number;
  due_day: number;
  account_id: string;
  category_id: string;
  payment: { id: string; amount: number } | null;
};
type Mode = { kind: 'menu' | 'edit'; bill: Bill } | { kind: 'new' } | null;

// Tanggal jatuh tempo di bulan itu; 31 di Februari jadi hari terakhir.
const dueDate = (ym: string, day: number) => {
  const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return `${ym}-${String(Math.min(day, last)).padStart(2, '0')}`;
};

export function BillsScreen(props: {
  ym: string;
  current: string;
  failed: boolean;
  bills: Bill[];
  accounts: Named[];
  categories: Named[];
}) {
  const { ym, current, failed, bills, accounts, categories } = props;
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);
  const nameOf = (list: Named[], id: string) => list.find((x) => x.id === id)?.name ?? '';
  const unpaid = bills.filter((b) => !b.payment);
  const owed = unpaid.reduce((s, b) => s + b.nominal_expected, 0);
  const href = (m: string) => (m === current ? '/tagihan' : `/tagihan?m=${m}`);
  const liveAccounts = accounts.filter((a) => !a.archived_at);

  return (
    <>
      <div className="band">
        <a className="arrow" href={href(shiftYm(ym, -1))} aria-label="Bulan sebelumnya">←</a>
        <span className="month-label">{ymLabel(ym)}</span>
        <a className="arrow" href={href(shiftYm(ym, 1))} aria-label="Bulan berikutnya">→</a>
        <span className="band-total amt">
          {unpaid.length ? <>{rp(owed)} <span className="debt">belum lunas</span></> : bills.length ? 'Semua lunas' : ''}
        </span>
      </div>

      {failed ? (
        <p className="note err">Tagihan gagal dimuat. <a href={href(ym)}>Coba lagi</a></p>
      ) : bills.length === 0 ? (
        <p className="note">Belum ada tagihan rutin. Tambahkan listrik, internet, atau cicilan supaya bisa dicentang tiap bulan.</p>
      ) : (
        bills.map((b) => (
          <button key={b.id} className="row" onClick={() => setMode({ kind: 'menu', bill: b })}>
            <span className="row-main">
              <span className="t16">{b.name}</span>
              <span className="meta">Jatuh tempo {Number(dueDate(ym, b.due_day).slice(8))} · {nameOf(accounts, b.account_id)}</span>
            </span>
            <span className="side">
              <span className="amt">{rp(b.payment?.amount ?? b.nominal_expected)}</span>
              <span className={b.payment ? 'meta' : 'badge'}>{b.payment ? 'Lunas' : 'Belum lunas'}</span>
            </span>
          </button>
        ))
      )}
      <div className="spacer" />
      <div className="bottom">
        <button className="primary" onClick={() => setMode({ kind: 'new' })} disabled={liveAccounts.length === 0}>
          + Tambah tagihan
        </button>
        {liveAccounts.length === 0 && <p className="fhelp" style={{ marginTop: 8 }}>Tambahkan akun dulu di halaman Akun.</p>}
      </div>

      <Sheet open={mode?.kind === 'menu'} onClose={close} label="Tagihan">
        {mode?.kind === 'menu' && (
          <BillMenu bill={mode.bill} ym={ym} current={current} onEdit={() => setMode({ kind: 'edit', bill: mode.bill })} onClose={close} />
        )}
      </Sheet>
      <Sheet open={mode?.kind === 'new' || mode?.kind === 'edit'} onClose={close} label="Formulir tagihan">
        {(mode?.kind === 'new' || mode?.kind === 'edit') && (
          <BillForm
            bill={mode.kind === 'edit' ? mode.bill : undefined}
            accounts={liveAccounts.concat(accounts.filter((a) => a.archived_at && mode.kind === 'edit' && a.id === mode.bill.account_id))}
            categories={categories.filter((c) => !c.archived_at || (mode.kind === 'edit' && c.id === mode.bill.category_id))}
            onDone={close}
          />
        )}
      </Sheet>
    </>
  );
}

function useRun(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<Result>) => {
    setPending(true);
    setError('');
    const r = await fn();
    setPending(false);
    r.error ? setError(r.error) : onDone();
  };
  return { pending, error, run };
}

function BillMenu({ bill, ym, current, onEdit, onClose }: {
  bill: Bill; ym: string; current: string; onEdit: () => void; onClose: () => void;
}) {
  const [amount, setAmount] = useState(bill.nominal_expected);
  const [date, setDate] = useState(ym === current ? todayJkt() : dueDate(ym, bill.due_day));
  const [confirm, setConfirm] = useState<'' | 'unpay' | 'delete'>('');
  const { pending, error, run } = useRun(onClose);

  return (
    <>
      <div className="sheet-head">
        <h2 className="sheet-title">{bill.name} · {ymLabel(ym)}</h2>
        <button type="button" className="textbtn pad" onClick={onClose}>Batal</button>
      </div>
      {bill.payment ? (
        <>
          <div className="row">
            <span className="row-main"><span className="t16">Lunas</span><span className="meta">Tercatat sebagai pengeluaran</span></span>
            <span className="amt">{rp(bill.payment.amount)}</span>
          </div>
          <button
            className="row actbtn danger"
            disabled={pending}
            onClick={() => (confirm === 'unpay' ? run(() => unpayBill(bill.payment!.id)) : setConfirm('unpay'))}
          >
            {confirm === 'unpay' ? 'Ketuk lagi untuk membatalkan' : 'Batal lunas'}
          </button>
          {confirm === 'unpay' && <p className="note">Pengeluaran dari tagihan ini ikut dihapus.</p>}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); run(() => payBill(bill.id, ym, amount, date)); }}>
          <label className="field">
            <span className="flabel">Nominal dibayar</span>
            <MoneyInput value={amount} onChange={setAmount} big />
            {amount !== bill.nominal_expected && <span className="fhelp">Perkiraan {rp(bill.nominal_expected)}</span>}
          </label>
          <label className="field">
            <span className="flabel">Tanggal bayar</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div className="sheet-foot">
            <button className="primary" disabled={pending || amount <= 0 || !date}>
              {pending ? 'Menyimpan…' : 'Tandai lunas'}
            </button>
          </div>
        </form>
      )}
      <button className="row actbtn" onClick={onEdit}>Ubah tagihan</button>
      <button
        className="row actbtn danger"
        disabled={pending}
        onClick={() => (confirm === 'delete' ? run(() => deleteBill(bill.id)) : setConfirm('delete'))}
      >
        {confirm === 'delete' ? 'Ketuk lagi untuk menghapus' : 'Hapus tagihan'}
      </button>
      {confirm === 'delete' && <p className="note">Checklist tagihan ini hilang. Pengeluaran yang sudah tercatat tetap ada.</p>}
      {error && <p className="note err" role="alert">{error}</p>}
    </>
  );
}

function BillForm({ bill, accounts, categories, onDone }: {
  bill?: Bill; accounts: Named[]; categories: Named[]; onDone: () => void;
}) {
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill?.nominal_expected ?? 0);
  const [dueDay, setDueDay] = useState(bill ? String(bill.due_day) : '');
  const [accountId, setAccountId] = useState(bill?.account_id ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(
    bill?.category_id ?? categories.find((c) => c.name === 'Tagihan')?.id ?? '',
  );
  const { pending, error, run } = useRun(onDone);
  const day = Number(dueDay);
  const ready = name.trim() && amount > 0 && day >= 1 && day <= 31 && accountId && categoryId;

  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => saveBill({ id: bill?.id, name, amount, dueDay: day, accountId, categoryId })); }}>
      <div className="sheet-head">
        <h2 className="sheet-title">{bill ? 'Ubah tagihan' : 'Tagihan baru'}</h2>
        <button type="button" className="textbtn pad" onClick={onDone}>Batal</button>
      </div>
      <label className="field">
        <span className="flabel">Nama</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Misalnya Listrik PLN" autoComplete="off" />
      </label>
      <label className="field">
        <span className="flabel">Nominal perkiraan</span>
        <MoneyInput value={amount} onChange={setAmount} />
        <span className="fhelp">Bisa diubah saat menandai lunas.</span>
      </label>
      <label className="field">
        <span className="flabel">Tanggal jatuh tempo</span>
        <input className="input" type="text" inputMode="numeric" value={dueDay} placeholder="1 sampai 31"
          onChange={(e) => setDueDay(e.target.value.replace(/\D/g, '').slice(0, 2))} required />
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
      <div className="sheet-foot">
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={!ready || pending}>{pending ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
}
