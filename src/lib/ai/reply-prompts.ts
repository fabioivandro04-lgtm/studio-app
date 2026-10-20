import { z } from 'zod';
import { systemFor } from './prompts';
import type { BrandAi, ChatMessage, JsonSchemaSpec } from './types';

export type ReplyChannel = 'dm' | 'comment';

export interface ReplyTurn {
  fromBusiness: boolean;
  text: string;
}

/** Limites da resposta: mensagem direta (1000 bytes na API) e comentário (curto, é público). */
export const REPLY_MAX: Record<ReplyChannel, number> = { dm: 900, comment: 500 };
const HISTORY_MAX = 12;
const TURN_MAX = 600;

const CHANNEL_TEXT: Record<ReplyChannel, string> = {
  dm: 'Escreve a próxima resposta da marca nesta conversa de mensagens diretas do Instagram. Responde ao que o cliente perguntou por último, de forma calorosa e útil, como uma pessoa da equipa (sem dizer que és uma IA). 1 a 4 frases curtas.',
  comment:
    'Escreve a resposta pública da marca a este comentário num post do Instagram. Curta (1 ou 2 frases), simpática, começa por @utilizador. Se a pergunta pedir dados pessoais ou um orçamento, convida a pessoa a enviar mensagem direta.',
};

export function buildReplyMessages(o: {
  brand: BrandAi;
  knowledge: string;
  channel: ReplyChannel;
  customer: string;
  turns: ReplyTurn[];
  postCaption?: string;
}): ChatMessage[] {
  const history = o.turns
    .filter((t) => t.text.trim())
    .slice(-HISTORY_MAX)
    .map((t) => `${t.fromBusiness ? 'Marca' : `@${o.customer}`}: ${t.text.trim().slice(0, TURN_MAX)}`)
    .join('\n');
  const parts = [
    CHANNEL_TEXT[o.channel],
    o.knowledge.trim()
      ? `Respostas guardadas (a única fonte para preços, vagas, datas e condições):\n${o.knowledge.trim()}`
      : 'Não há respostas guardadas: não dês preços, vagas nem datas.',
    'Se a resposta não estiver nas respostas guardadas nem no contexto da empresa, diz que vais confirmar e pergunta o que a pessoa precisa (nunca inventes).',
    o.postCaption?.trim() ? `Legenda do post:\n${o.postCaption.trim().slice(0, 1000)}` : '',
    `${o.channel === 'dm' ? 'Conversa' : 'Comentário'}:\n${history}`,
    `Até ${REPLY_MAX[o.channel]} caracteres, sem hashtags. Devolve o texto em "text".`,
  ].filter(Boolean);
  return [systemFor(o.brand), { role: 'user', content: parts.join('\n\n') }];
}

const ReplyZ = z.object({ text: z.string() });
export const ReplySpec: JsonSchemaSpec<{ text: string }> = {
  name: 'reply',
  schema: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' } }, required: ['text'] },
  parse: (x) => ReplyZ.parse(x),
};
