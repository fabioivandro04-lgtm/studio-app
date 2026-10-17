export const FOLDER_NAME_MAX = 80;

/** Nome de pasta limpo (aparado, espaços juntos) ou null se vazio/longo demais. */
export function cleanFolderName(s: string): string | null {
  const n = s.trim().replace(/\s+/g, ' ');
  return n.length >= 1 && n.length <= FOLDER_NAME_MAX ? n : null;
}

/** Nome sugerido para a pasta de um post: o título, ou "Post de dd/mm" (day = AAAA-MM-DD). */
export function defaultFolderName(title: string, day: string): string {
  const t = title.trim().replace(/\s+/g, ' ').slice(0, FOLDER_NAME_MAX).trim();
  if (t) return t;
  const [, m, d] = day.split('-');
  return `Post de ${d}/${m}`;
}
