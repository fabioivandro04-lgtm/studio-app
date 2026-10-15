import { addDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Converte uma data/hora local (no fuso `tz`) para o instante UTC. Horas inexistentes avançam. */
export function localToUtc(date: string, time: string, tz: string): Date {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) throw new Error('Formato de data ou hora inválido');
  const result = fromZonedTime(`${date}T${time}:00`, tz);
  if (Number.isNaN(result.getTime())) throw new Error('Formato de data ou hora inválido');
  const back = utcToLocalParts(result, tz);
  if (back.date === date && back.time === time) return result;
  // Hora inexistente (mudança para a hora de verão): avança pelo tamanho do salto.
  return new Date(result.getTime() + 60 * 60 * 1000);
}

export function utcToLocalParts(d: Date, tz: string): { date: string; time: string } {
  return { date: formatInTimeZone(d, tz, 'yyyy-MM-dd'), time: formatInTimeZone(d, tz, 'HH:mm') };
}

export function formatInZone(d: Date, tz: string, pattern: string): string {
  return formatInTimeZone(d, tz, pattern, { locale: pt });
}

/** Próxima meia-noite no fuso `tz`, como instante UTC. */
export function nextMidnightIn(tz: string, now: Date): Date {
  const today = formatInTimeZone(now, tz, 'yyyy-MM-dd');
  const tomorrow = formatInTimeZone(addDays(fromZonedTime(`${today}T12:00:00`, tz), 1), tz, 'yyyy-MM-dd');
  return fromZonedTime(`${tomorrow}T00:00:00`, tz);
}
