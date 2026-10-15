import { notFound } from 'next/navigation';
import { Composer } from '@/components/composer/composer';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { loadComposer } from '../data';

// Os pedidos à IA (server actions desta página) podem demorar até ~45 s.
export const maxDuration = 60;

export default async function NovoPostPage({ searchParams }: { searchParams: Promise<{ data?: string; hora?: string; midia?: string }> }) {
  const { data: date, hora, midia } = await searchParams;
  const db = await createServerClient();
  const brandId = await selectedBrandId(await listBrands(db));
  const data = await loadComposer(db, { brandId, date, time: hora, mediaId: midia });
  if (!data) notFound();
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Novo post</h1>
      <Composer data={data} />
    </>
  );
}
