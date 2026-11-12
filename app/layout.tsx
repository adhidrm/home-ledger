import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Buku Belanja Rumah' };
export const viewport: Viewport = { themeColor: '#f7f5f0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <main className="col">{children}</main>
      </body>
    </html>
  );
}
