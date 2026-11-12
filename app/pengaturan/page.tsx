import { Nav } from '@/components/nav';
import { requireProfile } from '@/lib/session';
import { CopyCode } from './copy-code';
import { signOut } from './actions';
import { AiProviders } from './ai-providers';
import { ExportSection } from './export-section';
import { todayJkt } from '@/lib/format';

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile();
  const [household, members, providers] = await Promise.all([
    supabase.from('households').select('invite_code, drive_folder_id, last_export_at').single(),
    supabase.from('profiles').select('id, display_name, email').order('display_name'),
    supabase
      .from('ai_providers')
      .select('id, name, base_url, model, json_mode, temperature, is_active, key_hint')
      .order('created_at'),
  ]);
  const others = members.data?.filter((m) => m.id !== profile.id) ?? [];
  const full = others.length > 0;

  return (
    <>
      <Nav current="/pengaturan" />
      <h1 className="sr-only">Pengaturan</h1>

      <h2 className="section">Keluarga</h2>
      {household.error ? (
        <p className="note">
          Data keluarga gagal dimuat. <a href="/pengaturan">Muat ulang</a>
        </p>
      ) : full ? null : (
        <div className="row">
          <div className="row-main">
            <span className="flabel">Kode undangan</span>
            <span className="code">{household.data.invite_code}</span>
          </div>
          <CopyCode code={household.data.invite_code} />
        </div>
      )}
      {members.error ? null : full ? (
        others.map((m) => (
          <div className="row" key={m.id}>
            <div className="row-main">
              <span className="t16">{m.display_name ?? m.email}</span>
              <span className="meta">{m.email}</span>
            </div>
          </div>
        ))
      ) : (
        <p className="note">Belum ada anggota lain. Minta pasangan login, pilih gabung, lalu masukkan kode di atas.</p>
      )}

      <h2 className="section">Penyedia AI</h2>
      {providers.error ? (
        <p className="note">
          Penyedia AI gagal dimuat. <a href="/pengaturan">Muat ulang</a>
        </p>
      ) : (
        <AiProviders providers={providers.data.map((p) => ({ ...p, temperature: Number(p.temperature) }))} />
      )}

      <ExportSection
        folderId={household.data?.drive_folder_id ?? null}
        lastExport={household.data?.last_export_at ?? null}
        current={todayJkt().slice(0, 7)}
      />

      <h2 className="section">Akun saya</h2>
      <div className="row">
        <div className="row-main">
          <span className="t16">{profile.display_name ?? profile.email}</span>
          <span className="meta">{profile.email}</span>
        </div>
        <form action={signOut}>
          <button className="textbtn danger">Keluar</button>
        </form>
      </div>
    </>
  );
}
