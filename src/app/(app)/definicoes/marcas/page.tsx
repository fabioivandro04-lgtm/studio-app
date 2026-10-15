import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { BrandsEditor } from './brands-editor';

export default async function MarcasPage() {
  const brands = await listBrands(await createServerClient());
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Marcas</h1>
      <BrandsEditor brands={brands.map(({ id, name, color, timezone }) => ({ id, name, color, timezone }))} />
    </div>
  );
}
