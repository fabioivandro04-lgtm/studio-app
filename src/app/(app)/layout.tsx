import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountMenu } from '@/components/account-menu';
import { AppNav } from '@/components/app-nav';
import { BrandSwitcher } from '@/components/brand-switcher';
import { ReauthBanner } from '@/components/reauth-banner';
import { Toaster } from '@/components/ui/sonner';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { inboxCount } from '@/lib/caixa/count';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const db = await createServerClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) redirect('/login');

  const [brands, { count: pending }, { data: reauth }, { count: claudeDrafts }] = await Promise.all([
    listBrands(db),
    db
      .from('post_targets')
      .select('id, posts!inner(status)', { count: 'exact', head: true })
      .in('status', ['awaiting_user', 'failed'])
      .neq('posts.status', 'cancelled'),
    db.from('social_accounts').select('id, platform, handle, status_message').eq('status', 'needs_reauth'),
    db.from('posts').select('id', { count: 'exact', head: true }).eq('origin', 'claude').eq('status', 'draft'),
  ]);
  const selected = await selectedBrandId(brands);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <AppNav inboxCount={inboxCount({ awaiting: pending ?? 0, failed: 0, claudeDrafts: claudeDrafts ?? 0 })} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <Link href="/calendario" className="flex items-center gap-2 font-bold tracking-tight text-primary">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-navy text-sm font-bold text-white ring-1 ring-brand-amber/60" aria-hidden>E</span>
            Estúdio
          </Link>
          <div className="flex items-center gap-2">
            <BrandSwitcher brands={brands} selected={selected} />
            <AccountMenu />
          </div>
        </header>
        <ReauthBanner accounts={reauth ?? []} />
        <main className="flex-1 px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>
      <Toaster richColors position="top-center" />
    </div>
  );
}
