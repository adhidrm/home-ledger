import { Nav } from '@/components/nav';

export default function Loading() {
  return (
    <>
      <Nav current="/tagihan" />
      <p className="note" role="status">Memuat tagihan…</p>
    </>
  );
}
