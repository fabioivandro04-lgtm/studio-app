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

/** Acrescenta no fim as hashtags que ainda não estão na legenda (hashtag inteira, sem distinguir maiúsculas). */
export function appendHashtags(caption: string, tags: string[]): string {
  const present = new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((h) => h.toLowerCase()));
  const missing = tags.filter((h) => !present.has(h.toLowerCase()));
  if (missing.length === 0) return caption;
  return `${caption.trimEnd()}${caption.trim() ? '\n\n' : ''}${missing.join(' ')}`;
}

/** Redes para a IA: as marcadas no post; sem nenhuma, as das contas ativas da marca. */
export function aiPlatformsFor<P extends string>(targetPlatforms: P[], accounts: { platform: P; status: string }[]): P[] {
  const source = targetPlatforms.length ? targetPlatforms : accounts.filter((a) => a.status === 'active').map((a) => a.platform);
  return [...new Set(source)];
}
