import type { Platform, TargetFormat } from '@/lib/platforms/types';
import { FORMAT_LABEL } from '@/lib/posts/schema';
import { AI_RULES, INTERNAL_TITLE_MAX, YT_TITLE_MAX } from './rules';
import type { BrandAi, ChatMessage, ContentPart, RefineAction } from './types';

export const PROMPT_MAX = 300;
const VOICE_CAPTIONS_MAX = 20;

const GOAL_TEXT = {
  contacts: 'Objetivo da marca: gerar contactos (mensagens, visitas ao perfil). Termina cada legenda com uma chamada para ação clara.',
  reach: 'Objetivo da marca: alcance máximo. Usa um gancho forte e linguagem simples para que mais pessoas vejam e partilhem.',
} as const;

function systemFor(brand: BrandAi): ChatMessage {
  const parts = [
    `És o gestor de redes sociais da marca "${brand.name}", com público lusófono (Moçambique, Angola, Cabo Verde e Portugal).`,
    "Escreve sempre em português de Portugal (nunca do Brasil), salvo quando o pedido indicar explicitamente outra língua: usa 'tu'/'vocês', evita o gerúndio ('estou a fazer', não 'estou fazendo'), 'equipa' e não 'time', 'registo' e não 'cadastro'.",
    'Nunca inventes preços, datas, vagas ou promessas que não estejam no contexto ou no pedido.',
    GOAL_TEXT[brand.goal],
  ];
  if (brand.aiContext.trim()) parts.push(`Contexto da empresa:\n${brand.aiContext.trim()}`);
  if (brand.aiVoice.trim()) parts.push(`Voz da marca:\n${brand.aiVoice.trim()}`);
  if (brand.aiHashtags.length) parts.push(`Hashtags fixas (incluir sempre): ${brand.aiHashtags.join(' ')}`);
  parts.push('Responde só com o JSON pedido.');
  return { role: 'system', content: parts.join('\n\n') };
}

export function buildSuggestMessages(o: {
  brand: BrandAi;
  prompt: string;
  imageUrl: string | null;
  targets: { platform: Platform; format: TargetFormat }[];
}): ChatMessage[] {
  const hasYoutube = o.targets.some((t) => t.platform === 'youtube');
  const networks = o.targets
    .map((t) => {
      const r = AI_RULES[t.platform];
      return `- ${t.platform} (${FORMAT_LABEL[t.format]}): ${r.style}; legenda até ${r.captionMax} caracteres sem hashtags; ${r.hashtagsMin}–${r.hashtagsMax} hashtags.`;
    })
    .join('\n');
  const instructions = [
    `Sobre o post: ${o.prompt.trim().slice(0, PROMPT_MAX)}`,
    o.imageUrl ? 'A imagem anexada é a mídia do post; usa o que vês nela.' : 'Não há imagem; baseia-te só no texto.',
    `Redes:\n${networks}`,
    'Para cada rede devolve em byPlatform: exatamente 3 legendas diferentes (captions) e as hashtags (hashtags) separadas da legenda.',
    `internalTitle: título curto para uso interno (até ${INTERNAL_TITLE_MAX} caracteres).`,
    hasYoutube ? `youtubeTitle: título do YouTube com palavra-chave, até ${YT_TITLE_MAX} caracteres.` : 'youtubeTitle: null.',
  ].join('\n\n');
  const content: ContentPart[] = [{ type: 'text', text: instructions }];
  if (o.imageUrl) content.push({ type: 'image_url', image_url: { url: o.imageUrl } });
  return [systemFor(o.brand), { role: 'user', content }];
}

const REFINE_TEXT: Record<RefineAction, string> = {
  shorten: 'Encurta esta legenda para cerca de metade, mantendo a mensagem principal.',
  catchy: 'Torna esta legenda mais chamativa, com um gancho mais forte na primeira linha.',
  professional: 'Reescreve esta legenda com um tom mais profissional e confiável.',
  cta: 'Acrescenta ou melhora a chamada para ação no fim desta legenda.',
  english: 'Traduz esta legenda para inglês, com naturalidade.',
};

export function buildRefineMessages(o: { brand: BrandAi; platform: Platform; text: string; action: RefineAction }): ChatMessage[] {
  const r = AI_RULES[o.platform];
  const user = [
    REFINE_TEXT[o.action],
    `Rede: ${o.platform} (até ${r.captionMax} caracteres).`,
    'Mantém as hashtags que já existirem. Devolve o texto final em "text".',
    `Legenda:\n${o.text}`,
  ].join('\n\n');
  return [systemFor(o.brand), { role: 'user', content: user }];
}

export function buildVoiceMessages(o: { brand: BrandAi; captions: string[] }): ChatMessage[] {
  const list = o.captions
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, VOICE_CAPTIONS_MAX)
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');
  const user = [
    'Analisa estas legendas recentes da marca e descreve a voz da marca para orientar quem escreve as próximas.',
    'Inclui: tom, tratamento (tu/vocês), tamanho típico, uso de emojis, chamadas para ação habituais e palavras ou temas a evitar.',
    'Máximo 1500 caracteres, em tópicos curtos. Devolve em "voice".',
    `Legendas:\n${list}`,
  ].join('\n\n');
  return [systemFor(o.brand), { role: 'user', content: user }];
}
