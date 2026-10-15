import { PendingItem, type PendingItemData } from '@/components/pending/pending-item';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { formatInZone } from '@/lib/time/zone';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function PendentesPage() {
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const { data } = await db
    .from('post_targets')
    .select('id, status, caption, last_error, external_post_id, updated_at, social_accounts(platform, handle), posts!inner(id, brand_id, internal_title, scheduled_at, post_media(position, media_assets(storage_path, thumbnail_path, kind)))')
    .in('status', ['awaiting_user', 'failed'])
    .neq('posts.status', 'cancelled') // posts cancelados não são falhas (não oferecer "Tentar de novo")
    .order('updated_at', { ascending: false })
    .limit(100);
  const rows = ((data ?? []) as any[]).filter((r) => !brandId || r.posts.brand_id === brandId);

  const thumbs = rows.map((r) => {
    const m = [...(r.posts.post_media ?? [])].sort((a: any, b: any) => a.position - b.position)[0]?.media_assets;
    return m ? (m.thumbnail_path ?? (m.kind === 'image' ? m.storage_path : null)) : null;
  });
  const signed = new Map<string, string>();
  const paths = thumbs.filter((p): p is string => !!p);
  if (paths.length) {
    const { data: s } = await db.storage.from('media').createSignedUrls(paths, 3600);
    for (const x of s ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
  }

  const items: PendingItemData[] = rows.map((r, i) => {
    const b = brands.find((x) => x.id === r.posts.brand_id);
    const tz = b?.timezone ?? 'Africa/Maputo';
    return {
      id: r.id, status: r.status, platform: r.social_accounts.platform, handle: r.social_accounts.handle,
      brandName: b?.name ?? '', brandColor: b?.color ?? '#999999', title: r.posts.internal_title, caption: r.caption,
      when: r.posts.scheduled_at ? formatInZone(new Date(r.posts.scheduled_at), tz, "d MMM 'às' HH:mm") : '',
      lastError: r.last_error, externalPostId: r.external_post_id, thumbUrl: thumbs[i] ? (signed.get(thumbs[i]!) ?? null) : null,
    };
  });
  const awaiting = items.filter((i) => i.status === 'awaiting_user');
  const failed = items.filter((i) => i.status === 'failed');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Pendentes</h1>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nada pendente. 🎉</p>}
      {awaiting.length > 0 && (
        <section className="space-y-2" aria-label="Aguarda 1 toque">
          <h2 className="font-medium">Aguarda 1 toque ({awaiting.length})</h2>
          <ul className="space-y-2">{awaiting.map((i) => <PendingItem key={i.id} item={i} />)}</ul>
        </section>
      )}
      {failed.length > 0 && (
        <section className="space-y-2" aria-label="Falhas">
          <h2 className="font-medium">Falhas ({failed.length})</h2>
          <ul className="space-y-2">{failed.map((i) => <PendingItem key={i.id} item={i} />)}</ul>
        </section>
      )}
    </div>
  );
}
