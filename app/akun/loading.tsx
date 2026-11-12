import { Nav } from '@/components/nav';

export default function Loading() {
  return (
    <>
      <Nav current="/akun" />
      <p className="note" role="status">Memuat saldo akun…</p>
    </>
  );
}
