// API key provider dienkripsi AES-GCM dengan AI_KEK (32 byte, base64) dari env Edge Function.
// Format tersimpan: v1:<iv base64>:<ciphertext base64>

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function kek(): Promise<CryptoKey | null> {
  const raw = Deno.env.get('AI_KEK');
  if (!raw) return null;
  const bytes = unb64(raw);
  if (bytes.length !== 32) return null;
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export const kekReady = async () => (await kek()) !== null;

export async function encrypt(plain: string): Promise<string> {
  const key = await kek();
  if (!key) throw new Error('AI_KEK belum diset');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)));
  return `v1:${b64(iv)}:${b64(ct)}`;
}

export async function decrypt(stored: string): Promise<string> {
  const key = await kek();
  if (!key) throw new Error('AI_KEK belum diset');
  const [v, iv, ct] = stored.split(':');
  if (v !== 'v1') throw new Error('format key tidak dikenal');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return new TextDecoder().decode(pt);
}

/** 'sk-abc...wxyz' -> 'sk-…wxyz'. Hanya ini yang boleh keluar ke browser. */
export const keyHint = (k: string) => (k.match(/^[a-z]+[-_]/i)?.[0] ?? '') + '…' + k.slice(-4);
