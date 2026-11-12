// Kontrak OCR (spec §6). Semua provider: OpenAI-compatible /chat/completions via fetch biasa.

export type ProviderCfg = { base_url: string; model: string; json_mode: boolean; temperature: number };

export type Receipt = {
  date: string | null;
  merchant: string | null;
  total: number;
  items: { name: string; qty: number; price: number }[];
  category_guess: string | null;
};

export type OcrResult =
  | { ok: true; parsed: Receipt; raw: string }
  | { ok: false; error: string; raw: string; status?: number };

// Skema ini kontrak dengan form. Mengubahnya = perubahan kode, bukan pengaturan.
const SCHEMA = `{"date":"YYYY-MM-DD|null","merchant":"string|null","total":0,"items":[{"name":"","qty":1,"price":0}],"category_guess":"string|null"}`;

function instructions(categories: string[]) {
  return [
    'Kamu membaca foto struk belanja Indonesia.',
    `Balas HANYA dengan satu objek JSON persis dengan bentuk ini: ${SCHEMA}`,
    'Aturan:',
    '- total: total akhir yang dibayar, integer rupiah tanpa titik atau koma (Rp12.500 -> 12500). Wajib > 0.',
    '- date: tanggal transaksi format YYYY-MM-DD, atau null kalau tidak terbaca.',
    '- items: setiap baris barang; price = harga satuan integer rupiah; qty angka.',
    `- category_guess: salah satu dari [${categories.join(', ')}], atau null.`,
    '- Jangan menambah kolom lain. Jangan menulis teks di luar JSON.',
  ].join('\n');
}

const isIso = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export function validate(v: unknown): Receipt | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const total = Number(o.total);
  if (!Number.isFinite(total) || total <= 0) return null;
  if (o.date !== null && o.date !== undefined && !isIso(o.date)) return null;
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    date: (o.date as string) ?? null,
    merchant: typeof o.merchant === 'string' && o.merchant.trim() ? o.merchant.trim() : null,
    total: Math.round(total),
    items: items
      .filter((i) => i && typeof i === 'object' && typeof (i as { name?: unknown }).name === 'string')
      .map((i) => {
        const it = i as { name: string; qty?: unknown; price?: unknown };
        return { name: it.name.trim(), qty: Number(it.qty) || 1, price: Math.round(Number(it.price) || 0) };
      }),
    category_guess: typeof o.category_guess === 'string' ? o.category_guess : null,
  };
}

/** JSON dari teks bebas: blok {…} pertama. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(cfg: ProviderCfg, key: string, messages: unknown[]) {
  const body: Record<string, unknown> = {
    model: cfg.model,
    temperature: cfg.temperature,
    max_tokens: 800,
    messages,
  };
  if (cfg.json_mode) body.response_format = { type: 'json_object' };
  const url = cfg.base_url.replace(/\/+$/, '') + '/chat/completions';
  const send = () =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
      redirect: 'manual', // 3xx = gagal, jangan ikuti ke host lain
    });

  let res = await send();
  if (res.status === 429 || res.status >= 500) {
    await sleep(2000); // 429/5xx: retry 1x setelah 2 detik
    res = await send();
  }
  const text = await res.text();
  return { status: res.status, text };
}

function providerMessage(text: string) {
  try {
    const j = JSON.parse(text);
    return String(j?.error?.message ?? j?.message ?? text).slice(0, 300);
  } catch {
    return text.slice(0, 300);
  }
}

export async function readReceipt(
  cfg: ProviderCfg,
  key: string,
  imageDataUrl: string,
  categories: string[],
): Promise<OcrResult> {
  const messages: unknown[] = [
    { role: 'system', content: instructions(categories) },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Baca struk ini.' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];

  let lastRaw = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const { status, text } = await call(cfg, key, messages);
    if (status < 200 || status >= 300) {
      // 4xx (key/model salah): jangan retry, tampilkan pesan provider.
      return { ok: false, status, raw: '', error: `Provider menjawab ${status}: ${providerMessage(text)}` };
    }
    let content = '';
    try { content = String(JSON.parse(text)?.choices?.[0]?.message?.content ?? ''); } catch {}
    lastRaw = content || text.slice(0, 4000);
    const parsed = validate(extractJson(content));
    if (parsed) return { ok: true, parsed, raw: lastRaw };

    // Tidak valid: retry 1x dengan prompt koreksi.
    messages.push(
      { role: 'assistant', content },
      {
        role: 'user',
        content: `Jawaban tadi tidak valid. total harus angka > 0 dan date harus YYYY-MM-DD atau null. Balas ulang hanya JSON: ${SCHEMA}`,
      },
    );
  }
  return { ok: false, raw: lastRaw, error: 'Jawaban provider tidak sesuai skema setelah 2 percobaan.' };
}
