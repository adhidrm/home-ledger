'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { createReceipt } from './actions';

// Spec §4: perkecil ke maks 1024px sisi terpanjang, JPEG q80, sebelum upload.
// Menerima File (galeri/kamera HP) atau <video> (webcam) — createImageBitmap mendukung keduanya.
async function shrink(src: File | HTMLVideoElement): Promise<Blob> {
  const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' });
  const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('toBlob'))), 'image/jpeg', 0.8));
}

export function PhotoButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [webcam, setWebcam] = useState(false);
  const captureRef = useRef<HTMLInputElement>(null);
  const off = disabled || busy;

  async function upload(src: File | HTMLVideoElement) {
    setWebcam(false);
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('photo', await shrink(src), 'struk.jpg');
      const r = await createReceipt(fd);
      if (r.id) return router.push(`/struk/${r.id}`);
      setError(r.error ?? 'Gagal mengunggah.');
    } catch {
      setError('Foto tidak terbaca. Coba foto lain.');
    }
    setBusy(false);
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) upload(file);
  };

  return (
    <>
      {error && <p className="errline" role="alert">{error}</p>}
      <label className={`hair${off ? ' off' : ''}`}>
        {busy ? 'Mengunggah…' : 'Foto struk'}
        <input type="file" accept="image/*" className="sr-only" disabled={off} onChange={onFile} />
      </label>
      <button
        type="button"
        className={`hair${off ? ' off' : ''}`}
        disabled={off}
        onClick={() => {
          // HP/tablet: aplikasi kamera bawaan lewat `capture`. Desktop mengabaikan `capture`,
          // jadi buka webcam sendiri lewat getUserMedia.
          if (matchMedia('(pointer: coarse)').matches) captureRef.current?.click();
          else setWebcam(true);
        }}
      >
        Kamera
      </button>
      <input ref={captureRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <Sheet open={webcam} onClose={() => setWebcam(false)} label="Foto struk dari kamera">
        <Webcam onShot={upload} onClose={() => setWebcam(false)} />
      </Sheet>
    </>
  );
}

function Webcam({ onShot, onClose }: { onShot: (v: HTMLVideoElement) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stream: MediaStream | undefined;
    let gone = false;
    (async () => {
      try {
        // mediaDevices tidak ada di http non-localhost; jatuh ke pesan error yang sama.
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (gone) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        video.current!.srcObject = s;
      } catch {
        setError('Kamera tidak bisa dibuka. Cek izin kamera di browser, atau pakai Foto struk.');
      }
    })();
    return () => {
      gone = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <>
      <div className="sheet-head">
        <h2 className="sheet-title">Kamera</h2>
        <button type="button" className="textbtn pad" onClick={onClose}>Tutup</button>
      </div>
      {error ? (
        <p className="errline cam-msg" role="alert">{error}</p>
      ) : (
        <video ref={video} className="cam" autoPlay playsInline muted onLoadedData={() => setReady(true)} />
      )}
      <div className="sheet-foot">
        <button type="button" className="primary" disabled={!ready} onClick={() => onShot(video.current!)}>
          Ambil foto
        </button>
      </div>
    </>
  );
}
