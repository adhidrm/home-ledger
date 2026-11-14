// Jalankan perintah supabase ke database remote lewat pooler IPv4.
// Pakai: node scripts/db.mjs db push [flag lain]
// URL dibaca dari .env.local (SUPABASE_DB_URL) supaya password tidak pernah diketik di terminal atau chat.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

try { process.loadEnvFile('.env.local'); } catch {}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL belum diisi di .env.local. Contohnya ada di .env.example.');
  process.exit(1);
}
// Tanpa shell: karakter % dan ! di URL tidak ditafsirkan cmd.exe.
const cli = createRequire(import.meta.url).resolve('supabase/dist/supabase.js');
const r = spawnSync(process.execPath, [cli, ...process.argv.slice(2), `--remote=${url}`], { stdio: 'inherit' });
process.exit(r.status ?? 1);
