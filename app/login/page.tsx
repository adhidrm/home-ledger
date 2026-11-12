import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <header className="hero">
        <h1>Buku Belanja Rumah</h1>
        <p>Masuk lewat link yang dikirim ke email. Tanpa kata sandi.</p>
      </header>
      <LoginForm linkError={error === 'link'} />
    </>
  );
}
