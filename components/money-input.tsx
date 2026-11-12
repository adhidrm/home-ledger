'use client';

import { parseRupiah, rp } from '@/lib/format';

// Ketik angka saja; tampil sebagai Rp dengan titik ribuan.
export function MoneyInput({
  value,
  onChange,
  big,
  autoFocus,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  big?: boolean;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      className={big ? 'input big' : 'input'}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      placeholder="Rp0"
      value={value ? rp(value) : ''}
      onChange={(e) => {
        const n = parseRupiah(e.target.value);
        if (Number.isSafeInteger(n)) onChange(n);
      }}
    />
  );
}
