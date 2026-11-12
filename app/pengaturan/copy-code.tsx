'use client';

import { useState } from 'react';

export function CopyCode({ code }: { code: string }) {
  const [label, setLabel] = useState('Salin');
  return (
    <button
      className="textbtn"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setLabel('Disalin');
        } catch {
          setLabel('Gagal menyalin');
        }
        setTimeout(() => setLabel('Salin'), 2000);
      }}
    >
      {label}
    </button>
  );
}
