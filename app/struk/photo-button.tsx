'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createReceipt } from './actions';

// Spec §4: perkecil ke maks 1024px sisi terpanjang, JPEG q80, sebelum upload.
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
  const off = disabled || busy;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('photo', await shrink(file), 'struk.jpg');
      const r = await createReceipt(fd);
      if (r.id) return router.push(`/struk/${r.id}`);
      setError(r.error ?? 'Gagal mengunggah.');
    } catch {
      setError('Foto tidak terbaca. Coba foto lain.');
    }
    setBusy(false);
  };

  return (
    <>
      {error && <p className="errline" role="alert">{error}</p>}
      <label className={`hair${off ? ' off' : ''}`}>
        {busy ? 'Mengunggah…' : 'Foto struk'}
        <input type="file" accept="image/*" className="sr-only" disabled={off} onChange={onFile} />
      </label>
      {/* `capture` membuka aplikasi kamera di HP; desktop mengabaikannya, jadi tombol ini disembunyikan di sana (.cam-btn). */}
      <label className={`hair cam-btn${off ? ' off' : ''}`}>
        Kamera
        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={off} onChange={onFile} />
      </label>
    </>
  );
}
