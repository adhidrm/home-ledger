'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Key hanya lewat sini ke Edge Function `ocr`. Tidak ada respons yang membawa key balik.
export type ProviderInput = { name: string; base_url: string; model: string; json_mode: boolean; temperature: number };
export type TestResult = { ok: boolean; raw?: string; error?: string };

async function call(body: object): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('ocr', { body });
  if (error) {
    // FunctionsHttpError: pesan ada di body respons.
    const ctx = (error as { context?: Response }).context;
    try { return (await ctx?.json()) ?? { error: 'Server OCR tidak menjawab.' }; } catch { return { error: 'Server OCR tidak menjawab.' }; }
  }
  return data;
}

export async function testProvider(id: string | undefined, provider: ProviderInput, apiKey: string): Promise<TestResult> {
  const r = await call({ action: 'test', provider_id: id, provider, api_key: apiKey || undefined });
  return { ok: r.ok === true, raw: r.raw as string | undefined, error: r.error as string | undefined };
}

export async function saveProvider(id: string | undefined, provider: ProviderInput, apiKey: string) {
  const r = await call({ action: 'save', provider_id: id, provider, api_key: apiKey || undefined });
  if (r.ok) revalidatePath('/pengaturan');
  return { error: r.ok ? undefined : String(r.error ?? 'Gagal menyimpan.') };
}

export async function activateProvider(id: string) {
  const r = await call({ action: 'activate', provider_id: id });
  if (r.ok) revalidatePath('/pengaturan');
  return { error: r.ok ? undefined : String(r.error ?? 'Gagal mengaktifkan.') };
}

export async function deleteProvider(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('ai_providers').delete().eq('id', id);
  revalidatePath('/pengaturan');
  return { error: error ? 'Gagal menghapus.' : undefined };
}
