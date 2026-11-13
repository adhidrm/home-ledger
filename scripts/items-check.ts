// Cek: validasi draf item struk dan aturan "perlu dicek".
import assert from 'node:assert';
import { cleanDrafts, itemsOff, parseQty } from '../lib/receipt-items.ts';

assert.equal(parseQty('1,5'), 1.5);
assert.equal(parseQty('2'), 2);
assert.ok(Number.isNaN(parseQty('dua')));
assert.ok(Number.isNaN(parseQty('')));

const r = cleanDrafts([
  { key: 'a', name: ' Beras ', qty: '2', price: 15000 },
  { key: 'b', name: '', qty: '1', price: 0 }, // belum disentuh: dibuang
  { key: 'c', name: '', qty: '1', price: 5000 }, // nama kosong
  { key: 'd', name: 'Gula', qty: '0', price: 5000 }, // qty 0
  { key: 'e', name: 'Bonus', qty: '1', price: 0 }, // harga 0 boleh
]);
assert.deepEqual(r.items, [
  { name: 'Beras', qty: 2, unit_price: 15000 },
  { name: 'Bonus', qty: 1, unit_price: 0 },
]);
assert.deepEqual(Object.keys(r.errors), ['c', 'd']);

assert.equal(itemsOff(30000, 30500, 2), false); // di bawah Rp1.000
assert.equal(itemsOff(30000, 33000, 2), true);
assert.equal(itemsOff(0, 33000, 0), false); // tanpa item tidak pernah "perlu dicek"
console.log('ok');
