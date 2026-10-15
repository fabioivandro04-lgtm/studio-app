type Snapshot = { brandId: string; internalTitle: string; mediaIds: string[]; date: string; time: string; targets: { accountId: string; format: string; caption: string; title: string | null }[] };

const pick = (s: Snapshot) => JSON.stringify([s.brandId, s.internalTitle, s.mediaIds, s.date, s.time, s.targets.map((t) => [t.accountId, t.format, t.caption, t.title])]);

/** O post no ecrã é diferente do que foi guardado? */
export function hasUnsavedChanges(saved: Snapshot, current: Snapshot): boolean {
  return pick(saved) !== pick(current);
}
