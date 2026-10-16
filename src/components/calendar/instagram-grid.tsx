import { Clapperboard, ExternalLink, Layers } from 'lucide-react';
import Link from 'next/link';
import { POST_STATUS_CLASS, POST_STATUS_LABEL } from '@/lib/calendar/status';
import { createServerClient } from '@/lib/db/clients';
import { instagramRecentPosts } from '@/lib/db/repo/instagram-recent';
import type { Brand } from '@/lib/db/types';
import { buildGrid, type PlannedGridPost } from '@/lib/instagram/grid';
import type { PostStatus, RecentPost, TargetFormat } from '@/lib/platforms/types';
import { formatInZone } from '@/lib/time/zone';
import { cn } from '@/lib/utils';

const FEED: TargetFormat[] = ['ig_image', 'ig_carousel', 'ig_reel'];
const PLANNED: PostStatus[] = ['draft', 'scheduled', 'needs_action', 'publishing'];

type Row = {
  id: string; internal_title: string; scheduled_at: string; status: PostStatus;
  post_targets: { format: TargetFormat; social_accounts: { platform: string } | null }[];
  post_media: { position: number; media_assets: { storage_path: string; thumbnail_path: string | null; kind: string } | null }[];
};

/** Grelha do perfil do Instagram: posts planeados (feed) por cima dos já publicados. */
export async function InstagramGrid({ brand }: { brand: Brand }) {
  const db = await createServerClient();
  const [{ data: rows }, published] = await Promise.all([
    db
      .from('posts')
      .select('id, internal_title, scheduled_at, status, post_targets(format, social_accounts(platform)), post_media(position, media_assets(storage_path, thumbnail_path, kind))')
      .eq('brand_id', brand.id)
      .in('status', PLANNED)
      .not('scheduled_at', 'is', null),
    instagramRecentPosts(db, brand.id).then(
      (r) => ({ ok: true as const, posts: r }),
      () => ({ ok: false as const, posts: [] as RecentPost[] }),
    ),
  ]);

  const feed = ((rows as unknown as Row[] | null) ?? [])
    .map((r) => ({ r, target: r.post_targets.find((t) => FEED.includes(t.format)) }))
    .filter((x) => x.target);
  const thumbPath = (r: Row) => {
    const m = [...r.post_media].sort((a, b) => a.position - b.position)[0]?.media_assets;
    return m ? (m.thumbnail_path ?? (m.kind === 'image' ? m.storage_path : null)) : null;
  };
  const paths = feed.map(({ r }) => thumbPath(r)).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from('media').createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
  }
  const planned: PlannedGridPost[] = feed.map(({ r, target }) => {
    const p = thumbPath(r);
    return { id: r.id, at: new Date(r.scheduled_at), status: r.status, thumbUrl: p ? (signed.get(p) ?? null) : null, title: r.internal_title, format: target!.format };
  });
  const items = buildGrid(planned, published.posts ?? []);

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {published.posts === null && (
        <p className="rounded-lg bg-highlight px-3 py-2 text-sm text-highlight-foreground">
          Esta marca não tem o Instagram ligado: só aparecem os posts planeados. <Link href="/definicoes/contas" className="underline">Ligar</Link>
        </p>
      )}
      {!published.ok && (
        <p role="alert" className="rounded-lg bg-[var(--st-failed-bg)] px-3 py-2 text-sm text-[var(--st-failed-fg)]">
          Não foi possível ler as publicações do Instagram agora. Os posts planeados aparecem na mesma.
        </p>
      )}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">Ainda não há posts para o feed do Instagram.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-lg border bg-border" data-testid="ig-grid">
          {items.map((it) => {
            const img = it.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">
                {it.kind === 'planned' ? it.title || 'Sem mídia' : 'Sem imagem'}
              </span>
            );
            const when = formatInZone(it.at, brand.timezone, 'd MMM');
            return (
              <li key={it.key} className="relative aspect-[3/4] bg-card">
                {it.kind === 'planned' ? (
                  <Link href={it.href} className="block size-full" aria-label={`${POST_STATUS_LABEL[it.status]} ${when}: ${it.title || 'sem título'}`}>
                    {img}
                    <span className={cn('absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium', POST_STATUS_CLASS[it.status])}>
                      {POST_STATUS_LABEL[it.status]} · {when}
                    </span>
                    {it.format === 'ig_reel' && <Clapperboard className="absolute right-1 top-1 size-4 text-white drop-shadow" aria-hidden />}
                    {it.format === 'ig_carousel' && <Layers className="absolute right-1 top-1 size-4 text-white drop-shadow" aria-hidden />}
                  </Link>
                ) : it.href ? (
                  <a href={it.href} target="_blank" rel="noreferrer" className="block size-full" aria-label={`Publicado ${when} (abre no Instagram)`}>
                    {img}
                    <ExternalLink className="absolute right-1 top-1 size-3.5 text-white opacity-80 drop-shadow" aria-hidden />
                  </a>
                ) : (
                  img
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">No topo, o que ainda vai sair (o mais distante primeiro); depois, as últimas publicações do perfil. Os Stories não aparecem na grelha.</p>
    </div>
  );
}
