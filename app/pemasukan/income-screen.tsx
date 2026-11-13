'use client';

import { useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Sheet } from '@/components/sheet';
import { dayLabel, rp, shiftYm, todayJkt, ymLabel } from '@/lib/format';
import { deleteIncome, saveIncome } from './income-actions';

export type IncomeAccount = { id: string; name: string };
type Row = { id: string; date: string; amount: number; account_id: string; source: string };

export function IncomeScreen(props: {
  ym: string;
  current: string;
  rows: Row[];
  failed: boolean;
  accounts: IncomeAccount[]; // semua akun, untuk nama di daftar
  targets: IncomeAccount[]; // akun aktif selain kartu kredit, untuk form
}) {
  const { ym, current, rows, failed, accounts, targets } = props;
  const [menu, setMenu] = useState<Row | null>(null);
  const [form, setForm] = useState<Row | 'new' | null>(null);
  const href = (m: string) => (m === current ? '/pemasukan' : `/pemasukan?m=${m}`);
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';

  return (
    <>
      <div className="band">
        <a className="arrow" href={href(shiftYm(ym, -1))} aria-label="Bulan sebelumnya">←</a>
        <span className="month-label">{ymLabel(ym)}</span>
        {ym < current ? (
          <a className="arrow" href={href(shiftYm(ym, 1))} aria-label="Bulan berikutnya">→</a>
        ) : (
          <span className="arrow" aria-hidden="true" />
        )}
        <span className="amt band-total">{rp(rows.reduce((s, r) => s + r.amount, 0))}</span>
      </div>

      {failed ? (
        <p className="note err">Daftar pemasukan gagal dimuat. <a href={href(ym)}>Coba lagi</a></p>
      ) : rows.length === 0 ? (
        <p className="note">
          {targets.length
            ? `Belum ada pemasukan di ${ymLabel(ym)}. Ketuk + Catat pemasukan untuk mulai.`
            : <>Belum ada rekening atau dompet. <a href="/akun">Tambahkan akun dulu</a>, lalu catat pemasukan di sini.</>}
        </p>
      ) : (
        rows.map((r) => (
          <button key={r.id} className="row" onClick={() => setMenu(r)}>
            <span className="row-main">
              <span className="t16">{r.source}</span>
              <span className="meta">{nameOf(r.account_id)} · {dayLabel(r.date)}</span>
            </span>
            <span className="amt">{rp(r.amount)}</span>
          </button>
        ))
      )}
      <div className="spacer" />

      <div className="bottom">
        <button className="primary" onClick={() => setForm('new')} disabled={!targets.length}>+ Catat pemasukan</button>
      </div>

      <Sheet open={Boolean(menu)} onClose={() => setMenu(null)} label="Pilihan pemasukan">
        {menu && (
          <IncomeMenu
            row={menu}
            meta={`${nameOf(menu.account_id)} · ${dayLabel(menu.date)}`}
            onEdit={() => { setForm(menu); setMenu(null); }}
            onClose={() => setMenu(null)}
          />
        )}
      </Sheet>
      <Sheet open={Boolean(form)} onClose={() => setForm(null)} label={form === 'new' ? 'Catat pemasukan' : 'Ubah pemasukan'}>
        {form && (
          <>
            <div className="sheet-head">
              <h2 className="sheet-title">{form === 'new' ? 'Catat pemasukan' : 'Ubah pemasukan'}</h2>
              <button type="button" className="textbtn pad" onClick={() => setForm(null)}>Batal</button>
            </div>
            <IncomeForm
              row={form === 'new' ? null : form}
              // Akun lama yang kini diarsipkan tetap bisa dipilih saat mengubah barisnya.
              accounts={form === 'new' || targets.some((a) => a.id === form.account_id)
                ? targets
                : [...targets, { id: form.account_id, name: nameOf(form.account_id) }]}
              onDone={() => setForm(null)}
            />
          </>
        )}
      </Sheet>
    </>
  );
}

function IncomeMenu({ row, meta, onEdit, onClose }: { row: Row; meta: string; onEdit: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <div className="row">
        <span className="row-main">
          <span className="t16">{row.source}</span>
          <span className="meta">{meta}</span>
        </span>
        <span className="amt">{rp(row.amount)}</span>
      </div>
      <button className="row actbtn" onClick={onEdit}>Ubah</button>
      <button
        className="row actbtn danger"
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          const r = await deleteIncome(row.id);
          r.error ? setError(r.error) : onClose();
        }}
      >
        {confirm ? 'Ketuk lagi untuk menghapus' : 'Hapus'}
      </button>
      {error && <p className="note err" role="alert">{error}</p>}
      <button className="row actbtn quiet" onClick={onClose}>Batal</button>
    </>
  );
}

// Tanpa kepala sheet: pemanggil yang menaruh judul (Ringkasan memakai pilihan Pengeluaran/Pemasukan).
export function IncomeForm({ row, accounts, onDone }: { row: Row | null; accounts: IncomeAccount[]; onDone: () => void }) {
  const [amount, setAmount] = useState(row?.amount ?? 0);
  const [date, setDate] = useState(row?.date ?? todayJkt());
  const [accountId, setAccountId] = useState(row?.account_id ?? accounts[0]?.id ?? '');
  const [source, setSource] = useState(row?.source ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        const r = await saveIncome({ id: row?.id, amount, date, accountId, source });
        setPending(false);
        r.error ? setError(r.error) : onDone();
      }}
    >
      <label className="field">
        <span className="flabel">Jumlah</span>
        <MoneyInput value={amount} onChange={setAmount} big autoFocus={!row} />
      </label>
      <label className="field">
        <span className="flabel">Sumber</span>
        <input className="input" value={source} onChange={(e) => setSource(e.target.value)} maxLength={80} placeholder="Misalnya Gaji November" autoComplete="off" required />
      </label>
      <label className="field">
        <span className="flabel">Tanggal</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label className="field">
        <span className="flabel">Masuk ke akun</span>
        <span className="selwrap">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="caret" aria-hidden="true">▾</span>
        </span>
        <span className="fhelp">Kartu kredit tidak muncul di sini karena isinya utang, bukan uang.</span>
      </label>
      <div className="sheet-foot">
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={amount <= 0 || !source.trim() || !accountId || !date || pending}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
