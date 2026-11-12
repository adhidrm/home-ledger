// Uji wajib §5: anon key tanpa sesi -> 0 baris di semua tabel, lewat REST sungguhan.
// Pakai: SUPABASE_URL=... ANON_KEY=... SERVICE_KEY=... node scripts/anon-check.mjs
// Tanpa env: baca dari `npx supabase status` (stack lokal). Butuh data di DB: tabel kosong = FAIL.
import { execSync } from 'node:child_process';

let { SUPABASE_URL: url, ANON_KEY: anon, SERVICE_KEY: service } = process.env;
if (!url) {
  const env = Object.fromEntries(
    execSync('npx supabase status -o env', { encoding: 'utf8' })
      .split('\n').map((l) => l.match(/^(\w+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  url = env.API_URL; anon = env.ANON_KEY; service = env.SERVICE_ROLE_KEY;
}

const tables = ['households', 'profiles', 'ledgers', 'accounts', 'categories', 'receipts',
  'receipt_items', 'transactions', 'account_adjustments', 'bills', 'bill_payments',
  'budget_caps', 'ai_providers', 'ai_credentials'];

const get = (path, key) => fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

let failed = 0;
for (const t of tables) {
  const r = await get(`/rest/v1/${t}?select=*`, anon);
  const body = await r.json();
  const ok = r.ok ? body.length === 0 : r.status === 401 || r.status === 403;
  // Fixture harus ada, kalau tidak "0 baris" tidak membuktikan apa-apa.
  const total = (await (await get(`/rest/v1/${t}?select=*`, service)).json()).length;
  if (!ok || !total) failed++;
  console.log(`${ok && total ? 'OK  ' : 'FAIL'} ${t.padEnd(20)} anon=${r.ok ? body.length : r.status} service=${total}`);
}

const s = await fetch(`${url}/storage/v1/object/list/receipts`, {
  method: 'POST',
  headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '' }),
});
const listed = s.ok ? (await s.json()).length : 0;
if (listed) failed++;
console.log(`${listed ? 'FAIL' : 'OK  '} storage receipts     anon=${s.ok ? listed : s.status}`);

if (failed) { console.error(`${failed} tabel gagal`); process.exit(1); }
console.log('Semua tabel: anon 0 baris.');
