// Cek: validasi draf item struk dan aturan "perlu dicek".
import assert from 'node:assert';
import { autoAmount, cleanDrafts, itemRows, itemsOff, parseQty } from '../lib/receipt-items.ts';

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

// Baris siap simpan: line_total dihitung di sini, isi yang tidak sah menolak semuanya.
assert.deepEqual(itemRows([{ name: ' Beras ', qty: 1.5, unit_price: 15000 }]), [
  { name: 'Beras', qty: 1.5, unit_price: 15000, line_total: 22500 },
]);
assert.equal(itemRows([{ name: 'Gula', qty: 0, unit_price: 5000 }]), null);
assert.equal(itemRows([{ name: ' ', qty: 1, unit_price: 5000 }]), null);
assert.equal(itemRows([{ name: 'Gula', qty: 1, unit_price: -1 }]), null);

// Nominal pengeluaran manual mengikuti jumlah item sampai diketik sendiri.
assert.equal(autoAmount(0, 0, 15000), 15000); // masih kosong
assert.equal(autoAmount(15000, 15000, 150000), 150000); // masih hasil isi otomatis
assert.equal(autoAmount(50000, 15000, 30000), 50000); // sudah diketik sendiri
assert.equal(autoAmount(15000, 15000, 0), 15000); // semua item dihapus: nominal tetap
console.log('ok');
