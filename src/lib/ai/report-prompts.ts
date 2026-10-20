import { z } from 'zod';
import { systemFor } from './prompts';
import type { BrandAi, ChatMessage, JsonSchemaSpec } from './types';

/** Números da semana que a IA comenta. Calculados na app; a IA não os inventa nem altera. */
export interface WeekFacts {
  weekStart: string;
  weekEnd: string;
  postsPublished: number;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  /** Mesmos números da semana anterior (null se não houver dados). */
  previous: { views: number; reach: number; likes: number } | null;
  followersGained: number | null;
  topPosts: { title: string; network: string; views: number; reach: number }[];
  ads: { spend: number; currency: string; reach: number; linkClicks: number; conversations: number; leads: number }[];
  scheduledNextWeek: number;
}

export interface WeeklyReport {
  headline: string;
  good: string[];
  improve: string[];
  nextWeek: string[];
}

export function buildReportMessages(o: { brand: BrandAi; facts: WeekFacts }): ChatMessage[] {
  const user = [
    'Escreve o resumo semanal das redes sociais desta marca para o dono, que não é especialista. Linguagem simples e direta.',
    'headline: uma frase com o essencial da semana (com o número mais importante).',
    'good: 2 a 4 pontos sobre o que correu bem, com números.',
    'improve: 1 a 3 pontos sobre o que correu pior ou falta fazer.',
    'nextWeek: 2 a 4 sugestões concretas para a próxima semana (temas, formatos, horários, anúncios).',
    'Usa só os números abaixo; não inventes métricas. Se não houver dados suficientes, diz isso com franqueza.',
    `Dados (JSON):\n${JSON.stringify(o.facts)}`,
  ].join('\n\n');
  return [systemFor(o.brand), { role: 'user', content: user }];
}

const ReportZ = z.object({ headline: z.string(), good: z.array(z.string()), improve: z.array(z.string()), nextWeek: z.array(z.string()) });
const strArr = { type: 'array', items: { type: 'string' } };
export const ReportSpec: JsonSchemaSpec<WeeklyReport> = {
  name: 'report',
  schema: {
    type: 'object', additionalProperties: false,
    properties: { headline: { type: 'string' }, good: strArr, improve: strArr, nextWeek: strArr },
    required: ['headline', 'good', 'improve', 'nextWeek'],
  },
  parse: (x) => ReportZ.parse(x),
};

/** Corta listas e textos longos (o modelo nem sempre respeita os limites). */
export function postprocessReport(r: WeeklyReport): WeeklyReport {
  const clean = (xs: string[], n: number) => xs.map((x) => x.trim()).filter(Boolean).slice(0, n).map((x) => x.slice(0, 300));
  return { headline: r.headline.trim().slice(0, 300), good: clean(r.good, 4), improve: clean(r.improve, 3), nextWeek: clean(r.nextWeek, 4) };
}
