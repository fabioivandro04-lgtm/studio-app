const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 20;

/** `?midia=id1,id2,…` → ids válidos, sem repetidos, pela ordem dada (máx. 20). */
export function parseMidia(raw: string | undefined): string[] {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s));
  return [...new Set(ids)].slice(0, MAX);
}

/** Ficheiros pré-escolhidos: a marca é a do primeiro que existe; os de outra marca ficam de fora. */
export function pickPrefilled(ids: string[], media: { id: string; brandId: string }[]): { brandId: string | null; mediaIds: string[] } {
  const byId = new Map(media.map((m) => [m.id, m]));
  const found = ids.map((id) => byId.get(id)).filter((m): m is { id: string; brandId: string } => !!m);
  const brandId = found[0]?.brandId ?? null;
  return { brandId, mediaIds: found.filter((m) => m.brandId === brandId).map((m) => m.id) };
}
