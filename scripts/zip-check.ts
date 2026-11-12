// Cek: crc32 vektor standar + zip bisa dibuka unzip sistem.
import assert from 'node:assert';
import { writeFileSync } from 'node:fs';
import { crc32, zip } from '../lib/zip.ts';

assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
const out = zip([
  { name: 'a.txt', data: new TextEncoder().encode('halo') },
  { name: 'struk-2026-11-12-toko.jpg', data: new Uint8Array([1, 2, 3, 255]) },
]);
writeFileSync(process.argv[2], out);
console.log('ok', out.length);
