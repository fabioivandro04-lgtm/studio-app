import { LogOut } from 'lucide-react';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { BrandSwitcher } from '@/components/brand-switcher';
import { ReauthBanner } from '@/components/reauth-banner';
import { Toaster } from '@/components/ui/sonner';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { signOut } from '../login/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await createServerClient();
  const { data } = await db.auth.getUser();
  if (!data.user) redirect('/login');

  const brands = await listBrands(db);
  const selected = await selectedBrandId(brands);
  const [{ count: pending }, { data: reauth }] = await Promise.all([
    db.from('post_targets').select('id', { count: 'exact', head: true }).in('status', ['awaiting_user', 'failed']),
    db.from('social_accounts').select('id, platform, handle, status_message').eq('status', 'needs_reauth'),
  ]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppNav pendingCount={pending ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <span className="font-semibold text-brand-navy">Estúdio</span>
          <div className="flex items-center gap-2">
            <BrandSwitcher brands={brands} selected={selected} />
            <form action={signOut}>
              <button type="submit" className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Sair">
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </header>
        <ReauthBanner accounts={reauth ?? []} />
        <main className="flex-1 px-4 py-4 md:px-6">{children}</main>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
