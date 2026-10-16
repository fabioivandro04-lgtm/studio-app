import { createServerClient } from '@/lib/db/clients';
import { listBrands, selectedBrandId } from '@/lib/db/repo/brands-repo';
import { fromDeadlineRow } from '@/lib/db/types';
import { DeadlineForm, DeleteDeadline } from './deadline-form';
import { PageHeader } from '@/components/ui-x/page-header';

export default async function PrazosPage() {
  const db = await createServerClient();
  const brands = await listBrands(db);
  const brandId = await selectedBrandId(brands);
  let q = db.from('deadlines').select('*').order('due_date');
  if (brandId) q = q.eq('brand_id', brandId);
  const { data } = await q;
  const deadlines = (data ?? []).map(fromDeadlineRow);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Prazos" />
      <p className="text-sm text-muted-foreground">Os prazos aparecem no calendário para planear o conteúdo antes de cada data.</p>
      {brands.length > 0 && <DeadlineForm brands={brands.map(({ id, name }) => ({ id, name }))} defaultBrandId={brandId} />}
      <ul className="divide-y rounded-xl border">
        {deadlines.length === 0 && <li className="p-4 text-sm text-muted-foreground">Ainda não há prazos.</li>}
        {deadlines.map((d) => {
          const b = brands.find((x) => x.id === d.brandId);
          return (
            <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: b?.color }} aria-hidden />
              <span className="font-medium">{d.dueDate.split('-').reverse().join('/')}</span>
              <span>{d.title}</span>
              {d.institution && <span className="text-muted-foreground">· {d.institution}</span>}
              {d.country && <span className="text-muted-foreground">· {d.country}</span>}
              {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="underline">link</a>}
              <span className="ml-auto"><DeleteDeadline id={d.id} /></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
