import { LogOut } from 'lucide-react';
import Link from 'next/link';
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
  const { data } = await db.auth.getClaims();
  if (!data?.claims) redirect('/login');

  const [brands, { count: pending }, { data: reauth }] = await Promise.all([
    listBrands(db),
    db
      .from('post_targets')
      .select('id, posts!inner(status)', { count: 'exact', head: true })
      .in('status', ['awaiting_user', 'failed'])
      .neq('posts.status', 'cancelled'),
    db.from('social_accounts').select('id, platform, handle, status_message').eq('status', 'needs_reauth'),
  ]);
  const selected = await selectedBrandId(brands);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppNav pendingCount={pending ?? 0} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-brand-navy px-4 py-2.5 text-white shadow-sm">
          <Link href="/calendario" className="flex items-center gap-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-amber text-sm font-bold text-brand-navy" aria-hidden>E</span>
            Estúdio
          </Link>
          <div className="flex items-center gap-2">
            <BrandSwitcher brands={brands} selected={selected} />
            <form action={signOut}>
              <button type="submit" className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Sair">
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
