import type { AiProvider, ChatMessage, Suggestions } from './types';

const SUGGESTIONS: Suggestions = {
  internalTitle: 'Prazos de candidatura',
  youtubeTitle: 'Prazos para estudar em Portugal em 2027',
  byPlatform: (['instagram', 'tiktok', 'youtube'] as const).map((platform) => ({
    platform,
    captions: [1, 2, 3].map((n) => `Sugestão ${n} para ${platform}: as candidaturas estão abertas. Fala connosco!`),
    hashtags: ['#estudarfora', '#bolsasdeestudo', '#candidaturas'],
  })),
};

const lastUserText = (messages: ChatMessage[]): string => {
  const m = [...messages].reverse().find((x) => x.role === 'user');
  if (!m) return '';
  return typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n');
};

/** Fornecedor falso para testes e modo PLATFORM_MODE=fake: respostas fixas e custo 0. */
export function createFakeAi(): AiProvider {
  return {
    async chat({ messages, spec }) {
      const usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
      let raw: unknown;
      if (spec.name === 'suggestions') raw = SUGGESTIONS;
      else if (spec.name === 'refined') {
        const caption = lastUserText(messages).split('Legenda:\n')[1] ?? '';
        raw = { text: `Versão melhorada: ${caption.slice(0, 80)}` };
      } else if (spec.name === 'ideas') {
        const n = Number(lastUserText(messages).match(/Quantidade: (\d+)/)?.[1] ?? 3);
        raw = {
          ideas: Array.from({ length: n }, (_, i) => ({
            title: `Ideia ${i + 1}: prazos de candidatura`,
            hook: 'Sabias que faltam poucas semanas?',
            outline: '- O que é\n- Documentos\n- Como a Unidreamity ajuda',
            caption: `Ideia ${i + 1}: as candidaturas estão abertas. Fala connosco!`,
            format: 'ig_reel',
            platforms: ['instagram', 'tiktok'],
          })),
        };
      } else if (spec.name === 'reply') {
        raw = { text: 'Olá! Obrigado pela mensagem 😊 Vou confirmar e já te respondo com todos os detalhes.' };
      } else if (spec.name === 'report') {
        raw = {
          headline: 'Semana estável: as visualizações mantiveram-se e o melhor post foi um Reel.',
          good: ['O Reel da semana teve o maior alcance.', 'Ganhaste novos seguidores.'],
          improve: ['Publicaste menos do que o planeado.'],
          nextWeek: ['Publica 2 Reels com um gancho forte nos primeiros 3 segundos.', 'Responde aos comentários no próprio dia.'],
        };
      } else raw = { voice: '- Tom próximo e confiável\n- Trata o público por tu\n- Termina com convite para falar connosco' };
      return { data: spec.parse(raw), usage };
    },
  };
}
