# home-ledger

Pencatat keuangan rumah tangga. Satu rumah, satu buku besar, banyak akun.

Next.js 16 (App Router) + Supabase (Postgres/RLS/Auth) + Cloudflare Workers via OpenNext.

## Fitur

- **Dashboard** — pengeluaran bulan berjalan vs batas bulanan, tagihan belum lunas, saldo akun, 5 kategori terbesar.
- **Pengeluaran** — catat transaksi, batas bulanan, kategori.
- **Tagihan** — tagihan berulang + status lunas per periode.
- **Akun** — rekening/dompet/kartu kredit, saldo turunan dari transaksi & penyesuaian.
- **Struk** — foto struk → OCR lewat AI provider sendiri → review item.
- **Ekspor** — kirim data + file struk ke folder Google Drive `Keuangan Rumah` (scope `drive.file`, token cuma di browser).

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local   # isi nilai dari supabase status
npx supabase start           # Postgres 54322, API 54321, Studio 54323
npm run db:push              # terapkan migrations
npm run dev                  # http://localhost:3000
```

Variabel wajib (`.env.example`):

| Variabel | Sumber |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `npx supabase status` → API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `npx supabase status` → publishable/anon key |
| `NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID` | Google Cloud OAuth client (Web), opsional untuk ekspor |

Rahasia server (tidak masuk `.env.local`): `SUPABASE_SERVICE_ROLE_KEY`, `KEK` untuk Edge Function `ocr`.

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `start` | build & serve Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | push migrations ke project tertaut |
| `npm run db:test` | jalankan tes SQL di `supabase/tests` remote |
| `npm run db:anon-check` | buktikan anon key tanpa sesi dapat 0 baris |
| `npm run preview` / `deploy` | build & jalankan Worker Cloudflare |

## Struktur

```
app/                 rute App Router (dashboard, pengeluaran, tagihan, akun, struk, pengaturan, login, mulai)
components/          money-input, nav, sheet
lib/                 format, session, receipt-files, zip
middleware.ts        refresh sesi Supabase + redirect ke /login
supabase/
  migrations/        schema, RPC household, saldo akun, bayar tagihan, drive export
  functions/ocr/     Edge Function: scan struk + simpan provider AI (key terenkripsi KEK)
  tests/             rls_test, household_test, balance_test
scripts/             anon-check.mjs, zip-check.ts
```

## Keamanan

- Semua tabel pakai RLS; isolasi antar rumah lewat `households`/`profiles`.
- API key AI provider hanya didekripsi di Edge Function `ocr`; respons tidak pernah memuat key.
- Base URL provider AI divalidasi: wajib `https://`, host publik, tolak IP literal/loopback (anti-SSRF).
- Token Google Drive hidup di browser saja.

## Deploy

`duit.proximalab.fyi` → Cloudflare Worker `home-ledger` (`wrangler.jsonc`, `open-next.config.ts`). Build: `npm run deploy`.
