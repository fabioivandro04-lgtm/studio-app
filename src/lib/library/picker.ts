/** Filtro de pasta no seletor do editor; uma pasta que não é desta marca volta a "todas". */
export function pickerFilter<T extends { folderId: string | null }>(media: T[], value: string, folderIds: string[]): { value: string; items: T[] } {
  if (value === 'none') return { value, items: media.filter((m) => !m.folderId) };
  if (value !== 'all' && folderIds.includes(value)) return { value, items: media.filter((m) => m.folderId === value) };
  return { value: 'all', items: media };
}
