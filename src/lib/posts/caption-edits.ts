interface HasCaption {
  accountId: string;
  caption: string;
}

/** Legendas antes de uma edição da IA; null = o destino ainda não existia. */
export type CaptionSnapshot = Record<string, string | null>;

export function snapshotCaptions<T extends HasCaption>(targets: T[], accountIds: string[]): CaptionSnapshot {
  return Object.fromEntries(accountIds.map((id) => [id, targets.find((t) => t.accountId === id)?.caption ?? null]));
}

export function setCaption<T extends HasCaption>(targets: T[], accountId: string, caption: string): T[] {
  return targets.map((t) => (t.accountId === accountId ? { ...t, caption } : t));
}

/** Desfaz só o que a IA mudou, mantendo edições posteriores noutros destinos. */
export function restoreCaptions<T extends HasCaption>(targets: T[], snap: CaptionSnapshot): T[] {
  return targets
    .filter((t) => snap[t.accountId] !== null)
    .map((t) => (t.accountId in snap ? { ...t, caption: snap[t.accountId] as string } : t));
}
