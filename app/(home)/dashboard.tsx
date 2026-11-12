'use client';

import { useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Sheet } from '@/components/sheet';
import { ACCOUNT_TYPES, rp, shiftYm, ymLabel, type AccountType } from '@/lib/format';
import { TxForm, type Named } from '../pengeluaran/tx-screen';
import { PhotoButton } from '../struk/photo-button';
import { saveCap } from './budget-actions';

type Balance = { id: string; name: string; type: AccountType; balance: number };

export function Dashboard(props: {
  ym: string;
  current: string;
  failed: boolean;
  spent: number;
  cap: number | null;
  lastCap: number;
  owed: number;
  owedCount: number;
  balances: Balance[];
  topCats: { name: string; amount: number }[];
  accounts: Named[];
  categories: Named[];
}) {
  const { ym, current, failed, spent, cap, owed, owedCount, balances, topCats, accounts, categories } = props;
  const [sheet, setSheet] = useState<'cap' | 'tx' | null>(null);
  const [allAcc, setAllAcc] = useState(false);
  const close = () => setSheet(null);
  const href = (m: string) => (m === current ? '/' : `/?m=${m}`);
  const listHref = ym === current ? '/pengeluaran' : `/pengeluaran?m=${ym}`;
  const hasAccounts = accounts.some((a) => !a.archived_at);

  // Spec: < 70% aman, 70–99% mendekati, >= 100% lewat. Palet kertas: tinta, lalu bata saat lewat.
  const pct = cap ? spent / cap : 0;
  const level = !cap ? '' : pct >= 1 ? 'over' : pct >= 0.7 ? 'near' : '';
  const maxCat = topCats[0]?.amount ?? 1;

  if (failed)
    return <p className="note err">Ringkasan gagal dimuat. <a href={href(ym)}>Coba lagi</a></p>;

  return (
    <>
      <div className="dash-month">
        <a className="arrow" href={href(shiftYm(ym, -1))} aria-label="Bulan sebelumnya">←</a>
        <span className="month-label">{ymLabel(ym)}</span>
        {ym < current ? (
          <a className="arrow" href={href(shiftYm(ym, 1))} aria-label="Bulan berikutnya">→</a>
        ) : (
          <span className="arrow" aria-hidden="true" />
        )}
      </div>

      <div className="strip">
        <div className="strip-head">
          <span className="flabel">Pengeluaran {ym === current ? 'bulan ini' : ymLabel(ym)}</span>
          <a className="textbtn" href={listHref}>Lihat daftar</a>
        </div>
        <div className="figure">{rp(spent)}</div>
        {cap ? (
          <>
            <div className="capbar">
              <div className="track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} aria-label="Pemakaian batas bulanan">
                <div className={`fill ${level}`} style={{ transform: `scaleX(${Math.min(pct, 1)})` }} />
              </div>
              <button className="textbtn" onClick={() => setSheet('cap')}>dari {rp(cap)}</button>
            </div>
            <p className={`capstatus ${level}`}>
              {level === 'over' ? `Lewat batas ${rp(spent - cap)}` : level === 'near' ? `Mendekati batas, sisa ${rp(cap - spent)}` : `Sisa ${rp(cap - spent)}`}
            </p>
          </>
        ) : (
          <button className="textbtn" onClick={() => setSheet('cap')}>Atur batas bulanan</button>
        )}
      </div>

      <a className="row" href="/tagihan">
        <span className="row-main">
          <span className="t16">Terutang {ym === current ? 'bulan ini' : ymLabel(ym)}</span>
          <span className="meta">{owedCount ? `${owedCount} tagihan belum lunas` : 'Tidak ada tagihan belum lunas'}</span>
        </span>
        <span className="amt">{rp(owed)}</span>
      </a>

      <h2 className="section">Saldo akun</h2>
      {balances.length === 0 ? (
        <p className="note">Belum ada akun. <a href="/akun">Tambahkan rekening atau dompet pertama.</a></p>
      ) : (
        <>
          {(allAcc ? balances : balances.slice(0, 3)).map((a) => (
            <div className="row" key={a.id}>
              <span className="row-main">
                <span className="t16">{a.name}</span>
                <span className="meta">{ACCOUNT_TYPES[a.type]}</span>
              </span>
              <span className="amt">
                {a.balance < 0 && '−'}{rp(a.balance)}
                {a.type === 'credit_card' && <span className="debt"> utang</span>}
              </span>
            </div>
          ))}
          {balances.length > 3 && (
            <button className="textbtn pad" style={{ textAlign: 'left' }} onClick={() => setAllAcc(!allAcc)}>
              {allAcc ? 'Tampilkan 3 saja' : `Lihat semua (${balances.length})`}
            </button>
          )}
        </>
      )}

      <h2 className="section">5 kategori terbesar</h2>
      {topCats.length === 0 ? (
        <p className="note">Belum ada pengeluaran di {ymLabel(ym)}.</p>
      ) : (
        topCats.map((c) => (
          <div className="cat" key={c.name}>
            <div className="cat-line"><span className="t16">{c.name}</span><span className="amt">{rp(c.amount)}</span></div>
            <div className="track2"><div className="fill2" style={{ transform: `scaleX(${c.amount / maxCat})` }} /></div>
          </div>
        ))
      )}

      <div className="spacer" />
      <div className="bottom">
        <div className="foot-btns">
          <PhotoButton disabled={!hasAccounts} />
          <button className="primary" onClick={() => setSheet('tx')} disabled={!hasAccounts}>+ Catat</button>
        </div>
      </div>

      <Sheet open={sheet === 'cap'} onClose={close} label="Batas bulanan">
        {sheet === 'cap' && <CapForm ym={ym} initial={cap ?? props.lastCap} hasCap={cap !== null} onDone={close} />}
      </Sheet>
      <Sheet open={sheet === 'tx'} onClose={close} label="Catat pengeluaran">
        {sheet === 'tx' && (
          <TxForm row={null} accounts={accounts.filter((a) => !a.archived_at)} categories={categories.filter((c) => !c.archived_at)} onDone={close} />
        )}
      </Sheet>
    </>
  );
}

function CapForm({ ym, initial, hasCap, onDone }: { ym: string; initial: number; hasCap: boolean; onDone: () => void }) {
  const [amount, setAmount] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const save = async (n: number) => {
    setPending(true);
    setError('');
    const r = await saveCap(ym, n);
    setPending(false);
    r.error ? setError(r.error) : onDone();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(amount); }}>
      <div className="sheet-head">
        <h2 className="sheet-title">Batas {ymLabel(ym)}</h2>
        <button type="button" className="textbtn pad" onClick={onDone}>Batal</button>
      </div>
      <label className="field">
        <span className="flabel">Batas pengeluaran sebulan</span>
        <MoneyInput value={amount} onChange={setAmount} big />
        {!hasCap && initial > 0 && <span className="fhelp">Diisi dari batas bulan sebelumnya. Boleh diubah.</span>}
      </label>
      <div className="sheet-foot">
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={pending || amount <= 0}>{pending ? 'Menyimpan…' : 'Simpan'}</button>
        {hasCap && (
          <button type="button" className="textbtn danger" style={{ textAlign: 'center' }} disabled={pending} onClick={() => save(0)}>
            Hapus batas bulan ini
          </button>
        )}
      </div>
    </form>
  );
}
