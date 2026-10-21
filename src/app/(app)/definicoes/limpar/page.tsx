import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { utcToLocalParts } from '@/lib/time/zone';
import { PageHeader } from '@/components/ui-x/page-header';
import { ClearForm } from './clear-form';

export default async function LimparPage() {
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  const tz = brands.find((b) => b.id === brandId)?.timezone ?? brands[0]?.timezone ?? 'Africa/Maputo';
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Limpar calendário" />
      <p className="text-sm text-muted-foreground">
        Apaga do Estúdio os rascunhos, agendados e cancelados a partir de uma data, para começar um calendário novo. O que já foi publicado fica no histórico e nada é apagado nas redes sociais.
      </p>
      {brands.length > 0
        ? <ClearForm brands={brands.map(({ id, name }) => ({ id, name }))} defaultBrandId={brandId} today={utcToLocalParts(new Date(), tz).date} />
        : <p className="text-sm text-muted-foreground">Ainda não há marcas.</p>}
    </div>
  );
}
