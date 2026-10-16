import { createServerClient } from '@/lib/db/clients';
import { listBrands } from '@/lib/db/repo/brands-repo';
import { listHashtagGroups } from '@/lib/db/repo/hashtag-groups-repo';
import { BrandsEditor } from './brands-editor';
import { PageHeader } from '@/components/ui-x/page-header';

// Os pedidos à IA (server actions desta página) podem demorar até ~45 s.
export const maxDuration = 60;

export default async function MarcasPage() {
  const db = await createServerClient();
  const [brands, groups, { data: ig }] = await Promise.all([
    listBrands(db),
    listHashtagGroups(db),
    db.from('social_accounts').select('brand_id').eq('platform', 'instagram').eq('status', 'active'),
  ]);
  const withIg = new Set((ig ?? []).map((a) => a.brand_id));
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4"><PageHeader title="Marcas" description="Nome, cor, fuso, voz e horários de cada marca." /></div>
      <BrandsEditor
        brands={brands.map((b) => ({
          id: b.id, name: b.name, color: b.color, timezone: b.timezone,
          ai: { brandId: b.id, aiContext: b.aiContext, aiVoice: b.aiVoice, aiHashtags: b.aiHashtags, goal: b.goal, postsPerWeek: b.postsPerWeek, postingSlots: b.postingSlots, hasInstagram: withIg.has(b.id) },
          groups: groups.filter((g) => g.brandId === b.id),
        }))}
      />
    </div>
  );
}
