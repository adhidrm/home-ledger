'use client';

import { useActionState } from 'react';
import { startHousehold, type StartState } from './actions';

export function StartForm() {
  const [state, action, pending] = useActionState<StartState, FormData>(startHousehold, {});

  return (
    <form action={action}>
      <label className="field">
        <span className="flabel">Nama kamu</span>
        <input className="input" name="name" required autoComplete="given-name" maxLength={40} />
      </label>

      <h2 className="section">Pasanganmu sudah membuat rumah?</h2>
      <label className="field">
        <span className="flabel">Kode undangan dari pasangan</span>
        <input
          className="input code-input"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="000000"
        />
      </label>
      <div className="actions">
        {state.error && <p className="errline" role="alert">{state.error}</p>}
        <button className="primary" name="intent" value="join" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Gabung ke rumah pasangan'}
        </button>
      </div>

      <h2 className="or">Belum ada yang membuat?</h2>
      <div className="actions">
        <p className="meta">Buat rumah baru, lalu bagikan kode undangannya dari halaman Pengaturan.</p>
        <button className="ghost" name="intent" value="create" formNoValidate disabled={pending}>
          Buat rumah baru
        </button>
      </div>
    </form>
  );
}
