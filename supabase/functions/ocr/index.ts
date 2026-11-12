// Edge Function: OCR struk (scan) + konfigurasi provider AI (test, save, activate).
// Satu-satunya tempat API key didekripsi. Respons tidak pernah berisi key.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { decrypt, encrypt, keyHint, kekReady } from '../_shared/kek.ts';
import { readReceipt, type ProviderCfg } from '../_shared/ocr.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(URL_, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SAMPLE = new URL('./sample-receipt.jpg', import.meta.url);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Body = {
  action: 'scan' | 'test' | 'save' | 'activate';
  receipt_id?: string;
  provider_id?: string;
  provider?: Partial<ProviderCfg> & { name?: string };
  api_key?: string;
};

function cleanCfg(p: Body['provider']): ProviderCfg | string {
  const base_url = String(p?.base_url ?? '').trim();
  const model = String(p?.model ?? '').trim();
  const temperature = Number(p?.temperature ?? 0);
  if (!/^https:\/\/[^\s]+$/.test(base_url)) return 'Base URL harus diawali https://';
  // Tolak alamat jaringan internal (SSRF). Nama host publik saja, bukan IP literal.
  let host = '';
  try { host = new URL(base_url).hostname.toLowerCase(); } catch { return 'Base URL tidak valid.'; }
  if (!host.includes('.') || /^[\d.]+$|^\[|\.(local|internal|localhost)$/.test(host)) return 'Base URL harus nama host publik.';
  if (!model) return 'Model wajib diisi.';
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) return 'Temperature antara 0 dan 2.';
  return { base_url, model, json_mode: Boolean(p?.json_mode), temperature };
}

async function storedKey(providerId: string) {
  const { data } = await admin.from('ai_credentials').select('api_key').eq('provider_id', providerId).maybeSingle();
  return data ? decrypt(data.api_key) : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST saja' }, 405);

  // Identitas dari JWT user; household dari profiles.
  const userClient = createClient(URL_, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await userClient.auth.getUser();
  if (!auth.user) return json({ error: 'Belum login.' }, 401);
  const { data: profile } = await admin.from('profiles').select('household_id').eq('id', auth.user.id).maybeSingle();
  if (!profile) return json({ error: 'Belum punya rumah.' }, 403);
  const householdId = profile.household_id as string;

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: 'Body bukan JSON.' }, 400); }

  // Provider yang disebut harus milik household ini.
  let owned: { id: string; base_url: string } | null = null;
  if (body.provider_id) {
    const { data } = await admin.from('ai_providers').select('id, base_url')
      .eq('id', body.provider_id).eq('household_id', householdId).maybeSingle();
    if (!data) return json({ error: 'Penyedia tidak ditemukan.' }, 404);
    owned = data;
  }

  if (body.action === 'scan') {
    // Struk harus milik ledger household ini.
    const { data: rc } = await admin.from('receipts').select('id, ledger_id, storage_path, ledgers!inner(household_id)')
      .eq('id', body.receipt_id ?? '').eq('ledgers.household_id', householdId).maybeSingle();
    if (!rc) return json({ error: 'Struk tidak ditemukan.' }, 404);

    const { data: pv } = await admin.from('ai_providers').select('id, base_url, model, json_mode, temperature')
      .eq('household_id', householdId).eq('is_active', true).maybeSingle();
    const key = pv ? await storedKey(pv.id).catch(() => null) : null;
    if (!pv || !key) return json({ status: 'not_configured' });

    const { data: file, error: dlErr } = await admin.storage.from('receipts').download(rc.storage_path);
    if (dlErr || !file) return json({ error: 'Foto struk tidak bisa dibaca dari storage.' }, 500);
    const { data: cats } = await admin.from('categories').select('name').eq('ledger_id', rc.ledger_id).is('archived_at', null);
    const dataUrl = 'data:image/jpeg;base64,' + encodeBase64(new Uint8Array(await file.arrayBuffer()));
    const r = await readReceipt({ ...pv, temperature: Number(pv.temperature) }, key, dataUrl, (cats ?? []).map((c) => c.name));

    if (!r.ok) {
      await admin.from('receipts').update({ status: 'failed', ocr_raw: r.raw || r.error }).eq('id', rc.id);
      return json({ status: 'failed', error: r.error });
    }
    // §4 Q26a: selisih Σ item vs total > max(1000, 1%) -> perlu dicek. Total struk tetap patokan.
    const items = r.parsed.items.map((i) => ({ receipt_id: rc.id, name: i.name || '?', qty: i.qty, unit_price: i.price, line_total: Math.round(i.qty * i.price) }));
    const sum = items.reduce((s, i) => s + i.line_total, 0);
    const off = items.length > 0 && Math.abs(sum - r.parsed.total) > Math.max(1000, r.parsed.total * 0.01);
    const status = off ? 'needs_check' : 'parsed';
    await admin.from('receipt_items').delete().eq('receipt_id', rc.id);
    if (items.length) await admin.from('receipt_items').insert(items);
    await admin.from('receipts').update({ status, ocr_raw: r.raw, parsed_total: r.parsed.total }).eq('id', rc.id);
    return json({ status });
  }

  if (body.action === 'test') {
    const cfg = cleanCfg(body.provider);
    if (typeof cfg === 'string') return json({ ok: false, error: cfg });
    if (!body.api_key?.trim() && owned && cfg.base_url !== owned.base_url)
      return json({ ok: false, error: 'Base URL berubah. Isi ulang API key.' });
    const key = body.api_key?.trim() || (owned ? await storedKey(owned.id) : null);
    if (!key) return json({ ok: false, error: 'Isi API key dulu.' });

    const { data: ledger } = await admin.from('ledgers').select('id').eq('household_id', householdId).eq('is_default', true).single();
    const { data: cats } = await admin.from('categories').select('name').eq('ledger_id', ledger!.id).is('archived_at', null);
    const img = await Deno.readFile(SAMPLE);
    const dataUrl = 'data:image/jpeg;base64,' + encodeBase64(img);
    const r = await readReceipt(cfg, key, dataUrl, (cats ?? []).map((c) => c.name));
    return json(r.ok ? { ok: true, raw: r.raw, parsed: r.parsed } : { ok: false, raw: r.raw, error: r.error });
  }

  if (body.action === 'save') {
    const cfg = cleanCfg(body.provider);
    if (typeof cfg === 'string') return json({ error: cfg }, 400);
    const name = String(body.provider?.name ?? '').trim();
    if (!name) return json({ error: 'Nama penyedia wajib diisi.' }, 400);
    const apiKey = body.api_key?.trim();
    if (apiKey && !(await kekReady())) return json({ error: 'AI_KEK belum diset di server. Key tidak disimpan.' }, 503);
    if (!apiKey && !owned) return json({ error: 'Isi API key.' }, 400);
    // Key tersimpan hanya boleh dipakai ke base_url yang sama (cegah key dibawa ke host lain).
    if (!apiKey && owned && cfg.base_url !== owned.base_url) return json({ error: 'Base URL berubah. Isi ulang API key.' }, 400);

    const row = { ...cfg, name, household_id: householdId, ...(apiKey ? { key_hint: keyHint(apiKey) } : {}) };
    const { data, error } = owned
      ? await admin.from('ai_providers').update(row).eq('id', owned.id).select('id').single()
      : await admin.from('ai_providers').insert(row).select('id').single();
    if (error) return json({ error: 'Gagal menyimpan penyedia.' }, 500);
    if (apiKey) {
      const { error: e2 } = await admin.from('ai_credentials')
        .upsert({ provider_id: data.id, api_key: await encrypt(apiKey) });
      if (e2) return json({ error: 'Gagal menyimpan key.' }, 500);
    }
    return json({ ok: true, id: data.id });
  }

  if (body.action === 'activate') {
    if (!owned) return json({ error: 'provider_id wajib.' }, 400);
    if (!(await admin.from('ai_credentials').select('provider_id').eq('provider_id', owned.id).maybeSingle()).data)
      return json({ error: 'Penyedia ini belum punya API key.' }, 400);
    // Satu yang aktif per household (dijaga juga oleh unique index).
    await admin.from('ai_providers').update({ is_active: false }).eq('household_id', householdId).eq('is_active', true);
    const { error } = await admin.from('ai_providers').update({ is_active: true }).eq('id', owned.id);
    return error ? json({ error: 'Gagal mengaktifkan.' }, 500) : json({ ok: true });
  }

  return json({ error: 'Aksi tidak dikenal.' }, 400);
});
