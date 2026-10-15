import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { BrandsEditor } from './brands-editor';

// Os pedidos à IA (server actions desta página) podem demorar até ~45 s.
export const maxDuration = 60;

export default async function MarcasPage() {
  const db = await createServerClient();
  const [brands, { data: ig }] = await Promise.all([
    listBrands(db),
    db.from('social_accounts').select('brand_id').eq('platform', 'instagram').eq('status', 'active'),
  ]);
  const withIg = new Set((ig ?? []).map((a) => a.brand_id));
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Marcas</h1>
      <BrandsEditor
        brands={brands.map((b) => ({
          id: b.id, name: b.name, color: b.color, timezone: b.timezone,
          ai: { brandId: b.id, aiContext: b.aiContext, aiVoice: b.aiVoice, aiHashtags: b.aiHashtags, goal: b.goal, hasInstagram: withIg.has(b.id) },
        }))}
      />
    </div>
  );
}
