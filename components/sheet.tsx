'use client';

import { useEffect, useRef } from 'react';

// <dialog> bawaan: Escape, fokus terkunci, dan backdrop tanpa kode tambahan.
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // autoFocus React jalan sebelum dialog terbuka; fokuskan field pertama di sini.
      d.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={label}
      // Hanya saat ditutup user (Escape). Tutup dari kode (open=false) tidak memanggil
      // onClose, supaya pindah sheet (menu -> form) tidak ikut mereset state.
      onClose={() => open && onClose()}
      onClick={(e) => e.target === ref.current && onClose()} // ketuk area gelap
    >
      {open && children}
    </dialog>
  );
}
