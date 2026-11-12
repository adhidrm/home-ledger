'use client';

import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { activateProvider, deleteProvider, saveProvider, testProvider, type ProviderInput, type TestResult } from './ai-actions';

export type Provider = ProviderInput & { id: string; is_active: boolean; key_hint: string | null };

// Preset hanya mengisi base_url + model; tetap bisa diubah (spec §6).
const PRESETS = [
  { name: 'OpenRouter', base_url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com', model: 'deepseek-flash' },
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'Gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  { name: 'Groq', base_url: 'https://api.groq.com/openai/v1', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { name: 'Lainnya', base_url: '', model: '' },
];

type Mode = { kind: 'menu' | 'edit'; p: Provider } | { kind: 'new' } | null;

export function AiProviders({ providers }: { providers: Provider[] }) {
  const [mode, setMode] = useState<Mode>(null);
  const close = () => setMode(null);

  return (
    <>
      {providers.map((p) => (
        <button key={p.id} className="row" onClick={() => setMode({ kind: 'menu', p })}>
          <span className="row-main">
            <span className="t16">{p.name}</span>
            <span className="meta">{p.model} · {p.key_hint ? `key ${p.key_hint}` : 'belum ada key'}</span>
          </span>
          {p.is_active && <span className="badge">Utama</span>}
        </button>
      ))}
      <button className="row actbtn" onClick={() => setMode({ kind: 'new' })}>+ Tambah penyedia</button>
      <p className="note">
        Provider harus mendukung input gambar (vision) dan format OpenAI <code>/chat/completions</code>. Key disimpan
        di server dan tidak pernah dikirim ke browser.
      </p>

      <Sheet open={mode?.kind === 'menu'} onClose={close} label="Pilihan penyedia">
        {mode?.kind === 'menu' && <Menu p={mode.p} onEdit={() => setMode({ kind: 'edit', p: mode.p })} onClose={close} />}
      </Sheet>
      <Sheet open={mode?.kind === 'new' || mode?.kind === 'edit'} onClose={close} label="Formulir penyedia">
        {(mode?.kind === 'new' || mode?.kind === 'edit') && (
          <ProviderForm p={mode.kind === 'edit' ? mode.p : undefined} onDone={close} />
        )}
      </Sheet>
    </>
  );
}

function Menu({ p, onEdit, onClose }: { p: Provider; onEdit: () => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<{ error?: string }>) => {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    r.error ? setError(r.error) : onClose();
  };

  return (
    <>
      <div className="row">
        <span className="row-main">
          <span className="t16">{p.name}</span>
          <span className="meta">{p.base_url}</span>
        </span>
      </div>
      <button className="row actbtn" onClick={onEdit}>Ubah</button>
      {!p.is_active && (
        <button className="row actbtn" disabled={busy || !p.key_hint} onClick={() => run(() => activateProvider(p.id))}>
          {p.key_hint ? 'Jadikan utama' : 'Jadikan utama (isi key dulu)'}
        </button>
      )}
      <button
        className="row actbtn danger"
        disabled={busy}
        onClick={() => (confirm ? run(() => deleteProvider(p.id)) : setConfirm(true))}
      >
        {confirm ? 'Ketuk lagi untuk menghapus' : 'Hapus'}
      </button>
      {confirm && p.is_active && !error && <p className="note">Ini penyedia utama. Setelah dihapus, OCR mati sampai ada penyedia utama baru.</p>}
      {error && <p className="note err" role="alert">{error}</p>}
      <button className="row actbtn quiet" onClick={onClose}>Batal</button>
    </>
  );
}

function ProviderForm({ p, onDone }: { p?: Provider; onDone: () => void }) {
  const [f, setF] = useState<ProviderInput>(
    p ?? { name: '', base_url: '', model: '', json_mode: true, temperature: 0 },
  );
  const [preset, setPreset] = useState('');
  const [key, setKey] = useState('');
  const [test, setTest] = useState<TestResult | 'running' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Ubah apa pun = hasil tes lama tidak berlaku lagi.
  const edit = (patch: Partial<ProviderInput>) => {
    setF({ ...f, ...patch });
    setTest(null);
  };
  const passed = typeof test === 'object' && test?.ok === true;
  const ready = f.name.trim() && f.base_url.trim() && f.model.trim() && (key.trim() || p?.key_hint);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        const r = await saveProvider(p?.id, f, key);
        setSaving(false);
        r.error ? setError(r.error) : onDone();
      }}
    >
      <div className="sheet-head">
        <h2 className="sheet-title">{p ? 'Ubah penyedia' : 'Penyedia baru'}</h2>
        <button type="button" className="textbtn pad" onClick={onDone}>Batal</button>
      </div>

      <div className="presets" role="group" aria-label="Preset">
        {PRESETS.map((x) => (
          <button
            key={x.name}
            type="button"
            className="chip"
            aria-pressed={preset === x.name}
            onClick={() => {
              setPreset(x.name);
              edit({ base_url: x.base_url, model: x.model, name: f.name || (x.base_url ? x.name : '') });
            }}
          >
            {x.name}
          </button>
        ))}
      </div>

      <label className="field">
        <span className="flabel">Nama</span>
        <input className="input" value={f.name} onChange={(e) => edit({ name: e.target.value })} maxLength={40} required />
      </label>
      <label className="field">
        <span className="flabel">Base URL</span>
        <input className="input" type="url" inputMode="url" value={f.base_url} placeholder="https://…"
          onChange={(e) => edit({ base_url: e.target.value })} required />
        {preset && preset !== 'Lainnya' && <span className="fhelp">Dari preset {preset}. Boleh diubah.</span>}
      </label>
      <label className="field">
        <span className="flabel">Model</span>
        <input className="input" value={f.model} onChange={(e) => edit({ model: e.target.value })} required
          autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      </label>
      <label className="field">
        <span className="flabel">Temperature</span>
        <input className="input" type="number" inputMode="decimal" min={0} max={2} step={0.1} value={f.temperature}
          onChange={(e) => edit({ temperature: Number(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={f.json_mode} onChange={(e) => edit({ json_mode: e.target.checked })} />
        Mode JSON (response_format)
      </label>
      <label className="field">
        <span className="flabel">API key</span>
        <input className="input" type="password" autoComplete="off" value={key}
          placeholder={p?.key_hint ? `Tersimpan ${p.key_hint}. Kosongkan kalau tidak diganti.` : 'Tempel key di sini'}
          onChange={(e) => { setKey(e.target.value); setTest(null); }} />
      </label>

      <div className="sheet-foot">
        <button
          type="button"
          className="ghost"
          disabled={!ready || test === 'running'}
          onClick={async () => {
            setTest('running');
            setTest(await testProvider(p?.id, f, key));
          }}
        >
          {test === 'running' ? `Menghubungi ${f.name || 'penyedia'}…` : 'Tes koneksi'}
        </button>
        {test && test !== 'running' && (
          <>
            <p className={test.ok ? 'okline' : 'errline'} role="status">
              {test.ok ? 'Tes berhasil: jawaban sesuai skema.' : `Tes gagal. ${test.error ?? ''}`}
            </p>
            {test.raw && <pre className="raw">{test.raw}</pre>}
          </>
        )}
        {!passed && <span className="fhelp">Simpan aktif setelah tes koneksi berhasil.</span>}
        {error && <p className="errline" role="alert">{error}</p>}
        <button className="primary" disabled={!passed || saving}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
