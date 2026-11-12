'use client';

import { useFormStatus } from 'react-dom';

// Nonaktif saat dikirim: ketukan ganda akan memakai token dua kali.
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="primary" disabled={pending}>
      {pending ? 'Masuk…' : 'Masuk'}
    </button>
  );
}
