import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold tracking-widest text-accent uppercase">Fiducial</p>
          <h1 className="mt-1 text-2xl font-semibold text-primary">Property ERP</h1>
          <p className="mt-1 text-sm text-muted-foreground">Property insurance placement</p>
        </div>
        <LoginForm next={typeof next === 'string' ? next : undefined} />
      </div>
    </main>
  );
}
