import { AI_MESSAGES, AiError } from './errors';
import type { AiProvider } from './types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const FALLBACK_USD_PER_M = { input: 3, output: 15 };

/** Extrai o JSON da resposta, tolerando um bloco ```json … ```. */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : content).trim());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createOpenRouter(o: { apiKey: string; appUrl: string; fetch: typeof fetch; timeoutMs?: number }): AiProvider {
  return {
    async chat({ model, messages, spec, maxTokens, timeoutMs }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs ?? o.timeoutMs ?? 45_000);
      let res: Response;
      try {
        res = await o.fetch(ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${o.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': o.appUrl,
            'X-Title': 'Estúdio',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            response_format: { type: 'json_schema', json_schema: { name: spec.name, strict: true, schema: spec.schema } },
            usage: { include: true },
          }),
        });
      } catch {
        throw new AiError('unavailable', AI_MESSAGES.unavailable);
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 401 || res.status === 402 || res.status === 403) throw new AiError('auth', AI_MESSAGES.auth);
      if ([400, 404, 413, 422].includes(res.status)) throw new AiError('bad_request', AI_MESSAGES.bad_request);
      if (!res.ok) throw new AiError('unavailable', AI_MESSAGES.unavailable);

      let body: any;
      try {
        body = await res.json();
      } catch {
        throw new AiError('invalid_response', AI_MESSAGES.invalid_response);
      }
      const u = body?.usage ?? {};
      const inputTokens = Number(u.prompt_tokens ?? 0);
      const outputTokens = Number(u.completion_tokens ?? 0);
      // Sem custo na resposta, estimar por excesso para o limite mensal continuar a valer.
      const costUsd = typeof u.cost === 'number' ? u.cost : (inputTokens * FALLBACK_USD_PER_M.input + outputTokens * FALLBACK_USD_PER_M.output) / 1e6;
      const usage = { inputTokens, outputTokens, costUsd };
      // Resposta paga mas inutilizável (cortada ou fora do esquema): o erro leva o custo.
      const unusable = () => new AiError('invalid_response', AI_MESSAGES.invalid_response, usage);
      const choice = body?.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== 'string' || choice?.finish_reason === 'length') throw unusable();
      let data;
      try {
        data = spec.parse(extractJson(content));
      } catch {
        throw unusable();
      }
      return { data, usage };
    },
  };
}
