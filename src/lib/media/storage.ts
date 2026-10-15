import type { SupabaseClient } from '@supabase/supabase-js';

export interface MediaStorage {
  signedUrl(path: string, expiresInS: number): Promise<string>;
  readRange(path: string, start: number, endInclusive: number): Promise<Uint8Array>;
}

export function createSupabaseStorage(client: SupabaseClient, bucket = 'media', fetchFn: typeof fetch = fetch): MediaStorage {
  const signedUrl = async (path: string, expiresInS: number) => {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInS);
    if (error || !data) throw new Error(`Não foi possível gerar o link do ficheiro ${path}: ${error?.message}`);
    return data.signedUrl;
  };
  return {
    signedUrl,
    async readRange(path, start, endInclusive) {
      const url = await signedUrl(path, 600);
      const res = await fetchFn(url, { headers: { Range: `bytes=${start}-${endInclusive}` } });
      if (res.status !== 206 && res.status !== 200) throw new Error(`Leitura do ficheiro falhou (${res.status})`);
      const buf = new Uint8Array(await res.arrayBuffer());
      // Se o servidor ignorar o Range e devolver o ficheiro inteiro, recortar.
      return res.status === 200 ? buf.subarray(start, endInclusive + 1) : buf;
    },
  };
}
