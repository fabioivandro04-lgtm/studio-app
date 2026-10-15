import { notFound } from 'next/navigation';
import { Composer } from '@/components/composer/composer';
import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { loadComposer } from '../data';

export default async function NovoPostPage({ searchParams }: { searchParams: Promise<{ data?: string; midia?: string }> }) {
  const { data: date, midia } = await searchParams;
  const db = await createServerClient();
  const brandId = await selectedBrandId(await listBrands(db));
  const data = await loadComposer(db, { brandId, date, mediaId: midia });
  if (!data) notFound();
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Novo post</h1>
      <Composer data={data} />
    </>
  );
}
