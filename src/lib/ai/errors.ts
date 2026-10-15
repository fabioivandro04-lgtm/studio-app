export type AiErrorCode = 'no_key' | 'budget' | 'auth' | 'unavailable' | 'invalid_response' | 'invalid_input';

/** Erro da IA com mensagem pronta a mostrar ao dono (pt-PT). */
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export const AI_MESSAGES = {
  no_key: 'Falta ligar a IA: adicione OPENROUTER_API_KEY na Vercel.',
  auth: 'A conta OpenRouter não tem crédito ou a chave é inválida.',
  unavailable: 'A IA está ocupada. Tente de novo dentro de momentos.',
  invalid_response: 'A IA respondeu de forma inesperada. Tente de novo.',
} as const;
