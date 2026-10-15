import { notFound } from 'next/navigation';
import { Composer } from '@/components/composer/composer';
import { createServerClient } from '@/lib/db/clients';
import { loadComposer } from '../data';

export default async function EditarPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadComposer(await createServerClient(), { postId: id });
  if (!data) notFound();
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{data.initial.locked ? 'Post' : 'Editar post'}</h1>
      <Composer data={data} />
    </>
  );
}
