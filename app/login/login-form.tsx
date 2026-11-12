'use client';

import { useActionState } from 'react';
import { sendLink, type LinkState } from './actions';

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(sendLink, {});

  if (state.sentTo) {
    return (
      <div className="actions">
        <p className="okline">
          Link masuk sudah dikirim ke <strong>{state.sentTo}</strong>. Buka emailnya di perangkat ini, lalu ketuk link-nya.
        </p>
        <p className="meta">Email belum datang? Cek folder spam, atau kirim ulang.</p>
        <form action={action}>
          <input type="hidden" name="email" value={state.sentTo} />
          <button className="ghost" disabled={pending}>
            {pending ? 'Mengirim…' : 'Kirim ulang link'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action}>
      <label className="field">
        <span className="flabel">Email</span>
        <input
          className="input"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="nama@email.com"
          defaultValue={state.email}
          key={state.email}
        />
      </label>
      <div className="actions">
        {linkError && !state.error && (
          <p className="errline" role="alert">Link sudah kedaluwarsa atau sudah dipakai. Kirim link baru.</p>
        )}
        {state.error && <p className="errline" role="alert">{state.error}</p>}
        <button className="primary" disabled={pending}>
          {pending ? 'Mengirim…' : 'Kirim link masuk'}
        </button>
      </div>
    </form>
  );
}
