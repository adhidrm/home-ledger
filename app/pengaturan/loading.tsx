import { Nav } from '@/components/nav';

export default function Loading() {
  return (
    <>
      <Nav current="/pengaturan" />
      <p className="note" role="status">Memuat data keluarga…</p>
    </>
  );
}
