'use client';

import { Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { checkFile } from '@/lib/media/check';
import { uploadMedia } from '@/lib/media/upload';
import { SelectField } from '@/components/ui-x/select-field';

const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 50);

export function MediaUploader({ brands, defaultBrandId, onUploaded, folderId = null }: {
  brands: { id: string; name: string }[];
  defaultBrandId: string | null;
  onUploaded?: (ids: string[]) => void;
  /** Ficheiros enviados ficam nesta pasta (a marca é a da pasta). */
  folderId?: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? '');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const busy = Object.keys(progress).length > 0;

  async function handle(files: FileList | null) {
    if (!files?.length || !brandId) return;
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      const check = checkFile(file, MAX_MB);
      if (!check.ok) {
        toast.error(check.message);
        continue;
      }
      setProgress((p) => ({ ...p, [file.name]: 0 }));
      try {
        ids.push(await uploadMedia(file, brandId, MAX_MB, (v) => setProgress((p) => ({ ...p, [file.name]: v })), folderId));
        toast.success(`"${file.name}" carregado.`);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setProgress((p) => {
          const { [file.name]: _done, ...rest } = p;
          return rest;
        });
      }
    }
    if (input.current) input.current.value = '';
    if (ids.length) {
      onUploaded?.(ids);
      router.refresh();
    }
  }

  if (brands.length === 0) return <p className="text-sm text-muted-foreground">Crie uma marca antes de carregar ficheiros.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {brands.length > 1 && (
        <SelectField aria-label="Marca do ficheiro" value={brandId} onChange={setBrandId} options={brands.map((b) => ({ value: b.id, label: b.name }))} className="w-48" />
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,video/mp4,video/quicktime,video/webm,.mov"
        className="sr-only"
        id="media-input"
        aria-label="Escolher ficheiros"
        onChange={(e) => handle(e.target.files)}
      />
      <Button type="button" onClick={() => input.current?.click()} disabled={busy}>
        <Upload className="size-4" aria-hidden /> Carregar ficheiros
      </Button>
      <span className="text-xs text-muted-foreground">Até {MAX_MB} MB por ficheiro</span>
      {Object.entries(progress).map(([name, v]) => (
        <span key={name} className="w-full text-xs text-muted-foreground" role="status">
          {name}: {Math.round(v * 100)}%
        </span>
      ))}
    </div>
  );
}
