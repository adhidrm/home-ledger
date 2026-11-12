const TABS = [
  { href: '/', label: 'Ringkasan' },
  { href: '/tagihan', label: 'Tagihan' },
  { href: '/akun', label: 'Akun' },
  { href: '/pengaturan', label: 'Pengaturan' },
];

export function Nav({ current }: { current: string }) {
  return (
    <nav className="tabs" aria-label="Halaman">
      {TABS.map((t) => (
        <a key={t.href} href={t.href} className="tab" aria-current={t.href === current ? 'page' : undefined}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
