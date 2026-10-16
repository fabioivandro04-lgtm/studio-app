import { format, isValid, parse } from 'date-fns';
import { pt } from 'date-fns/locale';

/** Dia de calendário (AAAA-MM-DD) como Date local ao meio-dia: nunca desloca o dia por causa do fuso. */
export const dayToDate = (iso: string): Date => new Date(`${iso}T12:00:00`);
export const dateToDay = (d: Date): string => format(d, 'yyyy-MM-dd');

/** '2026-10-17' → 'sáb, 17 out 2026' */
export function formatDayPt(iso: string): string {
  return format(dayToDate(iso), 'EEE, d MMM yyyy', { locale: pt }).replace(/\./g, '');
}

/** '17/10/2026' → '2026-10-17'; inválido → null */
export function parseDayPt(s: string): string | null {
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s.trim())) return null;
  const d = parse(s.trim(), 'd/M/yyyy', new Date(2000, 0, 1, 12));
  return isValid(d) && format(d, 'd/M/yyyy') === s.trim().replace(/^0/, '').replace(/\/0/, '/') ? dateToDay(d) : null;
}

/** '9:30' → '09:30'; fora de 00:00–23:59 ou minutos sem 2 dígitos → null */
export function normalizeTime(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
