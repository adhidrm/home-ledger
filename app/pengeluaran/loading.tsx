import { Nav } from '@/components/nav';

export default function Loading() {
  return (
    <>
      <Nav current="/" />
      <p className="note" role="status">Memuat pengeluaran…</p>
    </>
  );
}
