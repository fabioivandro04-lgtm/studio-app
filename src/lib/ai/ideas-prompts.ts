import type { Platform } from '@/lib/platforms/types';
import { IDEA_LIMITS } from './ideas-schema';
import { systemFor } from './prompts';
import type { BrandAi, ChatMessage } from './types';

export type IdeasMode = 'deadline' | 'shorts' | 'week';
const RECENT_MAX = 30;

const MODE_TEXT: Record<IdeasMode, string> = {
  deadline:
    'Cria uma sequência de posts para os dias antes deste prazo, por ordem, com urgência crescente: primeiro informar (o que é, para quem), depois preparar (documentos, passos), depois evitar erros, e no fim a contagem decrescente / último dia, sempre com chamada para ação.',
  shorts:
    'Cria ideias de vídeos curtos (Reels, TikTok, Shorts) com potencial para viralizar: cada uma com um gancho forte para os primeiros 3 segundos e um guião curto (3 a 5 frases ou planos).',
  week:
    'Cria um plano variado para a próxima semana: mistura temas educativos, prova social/histórias, dicas práticas e chamadas para ação. Se houver prazos próximos, inclui pelo menos uma ideia sobre eles.',
};

export function buildIdeasMessages(o: {
  brand: BrandAi;
  mode: IdeasMode;
  count: number;
  deadline: { title: string; dueDate: string; institution: string | null; country: string | null } | null;
  upcomingDeadlines: { title: string; dueDate: string }[];
  recentTitles: string[];
  platforms: Platform[];
}): ChatMessage[] {
  const parts = [MODE_TEXT[o.mode], `Quantidade: ${o.count}`, `Redes disponíveis: ${o.platforms.join(', ')}`];
  if (o.deadline) {
    const where = [o.deadline.institution, o.deadline.country].filter(Boolean).join(', ');
    parts.push(`Prazo: ${o.deadline.title}${where ? ` (${where})` : ''} — data limite ${o.deadline.dueDate}.`);
  }
  if (o.upcomingDeadlines.length) {
    parts.push(`Prazos próximos: ${o.upcomingDeadlines.map((d) => `${d.title} (${d.dueDate})`).join('; ')}`);
  }
  const recent = o.recentTitles.filter((t) => t.trim()).slice(0, RECENT_MAX);
  if (recent.length) parts.push(`Não repetir estes temas já usados: ${recent.join('; ')}`);
  parts.push(
    [
      'Para cada ideia devolve em "ideas":',
      `- title: título curto (até ${IDEA_LIMITS.title} caracteres)`,
      `- hook: frase de abertura que prende a atenção (até ${IDEA_LIMITS.hook})`,
      `- outline: guião ou pontos principais, um por linha começando por "- " (até ${IDEA_LIMITS.outline})`,
      `- caption: legenda de rascunho pronta a usar (até ${IDEA_LIMITS.caption})`,
      '- format: um de ig_image, ig_carousel, ig_reel, ig_story, tiktok_video, yt_short (ou null)',
      '- platforms: redes onde publicar, só das disponíveis',
    ].join('\n'),
  );
  return [systemFor(o.brand), { role: 'user', content: parts.join('\n\n') }];
}
