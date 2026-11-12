'use client';

import { useEffect, useState } from 'react';
import { shiftYm, ymLabel } from '@/lib/format';
import { exportData, listReceiptFiles, markExported } from './export-actions';

// Token Google hanya hidup di browser, sekali pakai per ekspor (scope drive.file). Tidak ada token di server.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'Keuangan Rumah';
const API = 'https://www.googleapis.com';

type TokenClient = { requestAccessToken: () => void };
type Gis = { accounts: { oauth2: { initTokenClient: (cfg: object) => TokenClient } } };
declare global { interface Window { google?: Gis } }

function loadGis() {
  if (window.google || document.getElementById('gis')) return;
  const s = document.createElement('script');
  s.id = 'gis';
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  document.head.appendChild(s);
}

async function drive(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (!res.ok && res.status !== 404) throw new Error(`Drive menjawab ${res.status}`);
  return res.status === 404 ? null : res.json();
}

async function ensureFolder(token: string, stored: string | null) {
  if (stored) {
    const f = await drive(token, `/drive/v3/files/${stored}?fields=id,trashed`);
    if (f && !f.trashed) return stored as string;
  }
  const f = await drive(token, '/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return f.id as string;
}

// Nama file tetap: timpa kalau sudah ada, buat kalau belum.
async function upsert(token: string, folder: string, f: { name: string; mime: string; content: string }) {
  const body = f.mime === 'text/csv' ? '﻿' + f.content : f.content; // BOM supaya Excel baca UTF-8
  const q = encodeURIComponent(`name='${f.name}' and '${folder}' in parents and trashed=false`);
  const found = await drive(token, `/drive/v3/files?q=${q}&fields=files(id)`);
  const id = found?.files?.[0]?.id;
  if (id) return drive(token, `/upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': f.mime }, body });
  const b = 'batas' + crypto.randomUUID();
  const multipart = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: f.name, parents: [folder] })}\r\n--${b}\r\nContent-Type: ${f.mime}\r\n\r\n${body}\r\n--${b}--`;
  return drive(token, '/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: multipart,
  });
}

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));

export function ExportSection({ folderId, lastExport, current }: { folderId: string | null; lastExport: string | null; current: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [ym, setYm] = useState(current);
  const [files, setFiles] = useState<string[] | null>(null);
  const [filesErr, setFilesErr] = useState(false);

  useEffect(() => { if (CLIENT_ID) loadGis(); }, []);
  useEffect(() => {
    setFiles(null);
    setFilesErr(false);
    listReceiptFiles(ym).then((r) => (r.error ? setFilesErr(true) : setFiles(r.files)));
  }, [ym]);

  const run = async (token: string) => {
    try {
      const data = await exportData();
      if (!data.files) throw new Error(data.error);
      const folder = await ensureFolder(token, folderId);
      for (const f of data.files) await upsert(token, folder, f);
      await markExported(folder);
      setState('done');
      setMsg(`${data.files.length} file tersimpan di folder ${FOLDER} di Google Drive.`);
    } catch (e) {
      setState('error');
      setMsg(`Ekspor gagal. ${(e as Error).message || 'Coba lagi.'}`);
    }
  };

  const start = () => {
    if (!window.google) return (setState('error'), setMsg('Layanan Google belum termuat. Periksa koneksi lalu coba lagi.'));
    setState('busy');
    setMsg('');
    // Harus dipanggil langsung dari klik supaya popup Google tidak diblokir.
    window.google.accounts.oauth2
      .initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (r: { access_token?: string; error?: string }) =>
          r.access_token ? run(r.access_token) : (setState('error'), setMsg('Izin Google Drive tidak diberikan.')),
        error_callback: () => (setState('idle'), setMsg('')),
      })
      .requestAccessToken();
  };

  return (
    <>
      <h2 className="section">Ekspor</h2>
      <div className="block">
        {CLIENT_ID ? (
          <button className="primary" onClick={start} disabled={state === 'busy'}>
            {state === 'busy' ? 'Mengekspor…' : 'Export ke Google Drive'}
          </button>
        ) : (
          <p className="note err" style={{ padding: 0, border: 0 }}>Export ke Google Drive belum dikonfigurasi di server.</p>
        )}
        <span className={state === 'error' ? 'errline' : 'meta'} role="status">
          {msg || (lastExport ? `Terakhir diekspor ${fmtTime(lastExport)}` : 'Belum pernah diekspor.')}
        </span>
      </div>

      <div className="row"><span className="t16">Download ZIP foto bulan ini</span></div>
      <div className="row">
        <span className="meta">Bulan</span>
        <span className="month">
          <button className="arrow" aria-label="Bulan sebelumnya" onClick={() => setYm(shiftYm(ym, -1))}>←</button>
          <span className="month-label">{ymLabel(ym)}</span>
          <button className="arrow" aria-label="Bulan berikutnya" onClick={() => setYm(shiftYm(ym, 1))} disabled={ym >= current}>→</button>
        </span>
      </div>
      {filesErr ? (
        <p className="note err">Daftar foto gagal dimuat. <button className="textbtn" onClick={() => setYm(ym)}>Coba lagi</button></p>
      ) : files === null ? (
        <p className="note" role="status">Memuat daftar foto…</p>
      ) : files.length === 0 ? (
        <p className="note">Tidak ada foto struk di {ymLabel(ym)}.</p>
      ) : (
        <>
          {files.map((f) => <div className="file" key={f}>{f}</div>)}
          <div className="block">
            <a className="ghost" href={`/struk/zip?m=${ym}`} download>Download ZIP ({files.length} foto)</a>
          </div>
        </>
      )}
    </>
  );
}
