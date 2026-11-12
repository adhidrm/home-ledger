'use client';

import { useState } from 'react';
import { MoneyInput } from '@/components/money-input';
import { Sheet } from '@/components/sheet';
import { ACCOUNT_TYPES, rp, type AccountType } from '@/lib/format';
import { adjustBalance, archiveAccount, saveAccount, type Result } from './actions';

type Account = { id: string; name: string; type: AccountType; balance: number };
type Mode = { kind: 'menu' | 'edit' | 'adjust'; acc: Account } | { kind: 'new' } | null;

export function AccountsScreen({ accounts }: { accounts: Account[] }) {
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  return (
    <>
      {accounts.length === 0 ? (
        <p className="note">Belum ada akun. Tambahkan rekening, dompet, atau kartu kredit yang dipakai belanja.</p>
      ) : (
        accounts.map((a) => (
          <button key={a.id} className="row" onClick={() => setMode({ kind: 'menu', acc: a })}>
            <span className="row-main">
              <span className="t16">{a.name}</span>
              <span className="meta">{ACCOUNT_TYPES[a.type]}</span>
            </span>
            <span className="amt">
              {a.balance < 0 && '−'}
              {rp(a.balance)}
              {a.type === 'credit_card' && <span className="debt"> utang</span>}
            </span>
          </button>
        ))
      )}
      <div className="spacer" />
      <div className="bottom">
        <button className="primary" onClick={() => setMode({ kind: 'new' })}>
          + Tambah akun
        </button>
      </div>

      <Sheet open={mode?.kind === 'menu'} onClose={close} label="Pilihan akun">
        {mode?.kind === 'menu' && (
          <AccountMenu acc={mode.acc} onPick={(kind) => setMode({ kind, acc: mode.acc })} onClose={close} />
        )}
      </Sheet>
      <Sheet open={mode?.kind === 'new' || mode?.kind === 'edit'} onClose={close} label="Formulir akun">
        {(mode?.kind === 'new' || mode?.kind === 'edit') && (
          <AccountForm acc={mode.kind === 'edit' ? mode.acc : undefined} onDone={close} />
        )}
      </Sheet>
      <Sheet open={mode?.kind === 'adjust'} onClose={close} label="Sesuaikan saldo">
        {mode?.kind === 'adjust' && <AdjustForm acc={mode.acc} onDone={close} />}
      </Sheet>
    </>
  );
}

function AccountMenu({
  acc,
  onPick,
  onClose,
}: {
  acc: Account;
  onPick: (k: 'edit' | 'adjust') => void;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  return (
    <>
      <div className="row">
        <span className="row-main">
          <span className="t16">{acc.name}</span>
          <span className="meta">{ACCOUNT_TYPES[acc.type]}</span>
        </span>
        <span className="amt">{rp(acc.balance)}</span>
      </div>
      <button className="row actbtn" onClick={() => onPick('adjust')}>
        Sesuaikan saldo
      </button>
      <button className="row actbtn" onClick={() => onPick('edit')}>
        Ganti nama
      </button>
      <button
        className="row actbtn danger"
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          const r = await archiveAccount(acc.id);
          r.error ? setError(r.error) : onClose();
        }}
      >
        {confirm ? 'Ketuk lagi untuk mengarsipkan' : 'Arsipkan'}
      </button>
      {confirm && !error && (
        <p className="note">Akun hilang dari daftar dan formulir. Riwayat transaksinya tetap tersimpan.</p>
      )}
      {error && <p className="note err" role="alert">{error}</p>}
      <button className="row actbtn quiet" onClick={onClose}>
        Batal
      </button>
    </>
  );
}

function SheetHead({ title, onCancel }: { title: string; onCancel: () => void }) {
  return (
    <div className="sheet-head">
      <h2 className="sheet-title">{title}</h2>
      <button type="button" className="textbtn pad" onClick={onCancel}>
        Batal
      </button>
    </div>
  );
}

function useSubmit(onDone: () => void) {
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

function AccountForm({ acc, onDone }: { acc?: Account; onDone: () => void }) {
  const [name, setName] = useState(acc?.name ?? '');
  const [type, setType] = useState<AccountType>(acc?.type ?? 'bank');
  const [opening, setOpening] = useState(0);
  const { pending, error, run } = useSubmit(onDone);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveAccount({ id: acc?.id, name, type, opening }));
      }}
    >
      <SheetHead title={acc ? 'Ganti nama akun' : 'Akun baru'} onCancel={onDone} />
      <label className="field">
        <span className="flabel">Nama</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={40}
          autoFocus
          placeholder="Misalnya BCA atau Dompet"
        />
      </label>
      {!acc && (
        <>
          <label className="field">
            <span className="flabel">Jenis</span>
            <span className="selwrap">
              <select className="input" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="caret" aria-hidden="true">▾</span>
            </span>
          </label>
          <label className="field">
            <span className="flabel">{type === 'credit_card' ? 'Utang saat ini' : 'Saldo saat ini'}</span>
            <MoneyInput value={opening} onChange={setOpening} />
            <span className="fhelp">Jadi saldo awal. Koreksi berikutnya lewat Sesuaikan saldo.</span>
          </label>
        </>
      )}
      <div className="sheet-foot">
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={pending || !name.trim()}>
          {pending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}

function AdjustForm({ acc, onDone }: { acc: Account; onDone: () => void }) {
  const [actual, setActual] = useState(acc.balance);
  const [note, setNote] = useState('');
  const { pending, error, run } = useSubmit(onDone);
  const delta = actual - acc.balance;
  const debt = acc.type === 'credit_card';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => adjustBalance({ accountId: acc.id, actual, note }));
      }}
    >
      <SheetHead title={`Sesuaikan ${acc.name}`} onCancel={onDone} />
      <div className="row">
        <span className="meta">{debt ? 'Utang tercatat' : 'Saldo tercatat'}</span>
        <span className="amt">{rp(acc.balance)}</span>
      </div>
      <label className="field">
        <span className="flabel">{debt ? 'Utang sebenarnya' : 'Saldo sebenarnya'}</span>
        <MoneyInput value={actual} onChange={setActual} big autoFocus />
        <span className="fhelp">
          {delta === 0 ? 'Sama dengan catatan.' : `Selisih ${delta > 0 ? '+' : '−'}${rp(delta)} dicatat sebagai penyesuaian.`}
        </span>
      </label>
      <label className="field">
        <span className="flabel">Alasan</span>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          maxLength={120}
          placeholder="Misalnya bunga bank, atau lupa mencatat"
        />
      </label>
      <div className="sheet-foot">
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={pending || delta === 0 || !note.trim()}>
          {pending ? 'Menyimpan…' : 'Simpan penyesuaian'}
        </button>
      </div>
    </form>
  );
}
