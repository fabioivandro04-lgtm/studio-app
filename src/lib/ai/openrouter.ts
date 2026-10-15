import { AI_MESSAGES, AiError } from './errors';
import type { AiProvider } from './types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/** Extrai o JSON da resposta, tolerando um bloco ```json … ```. */
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : content).trim());
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function createOpenRouter(o: { apiKey: string; appUrl: string; fetch: typeof fetch; timeoutMs?: number }): AiProvider {
  return {
    async chat({ model, messages, spec, maxTokens }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), o.timeoutMs ?? 45_000);
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
      if (!res.ok) throw new AiError('unavailable', AI_MESSAGES.unavailable);

      let body: any;
      try {
        body = await res.json();
      } catch {
        throw new AiError('invalid_response', AI_MESSAGES.invalid_response);
      }
      const content = body?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new AiError('invalid_response', AI_MESSAGES.invalid_response);
      let data;
      try {
        data = spec.parse(extractJson(content));
      } catch {
        throw new AiError('invalid_response', AI_MESSAGES.invalid_response);
      }
      const u = body.usage ?? {};
      return {
        data,
        usage: {
          inputTokens: Number(u.prompt_tokens ?? 0),
          outputTokens: Number(u.completion_tokens ?? 0),
          costUsd: Number(u.cost ?? 0),
        },
      };
    },
  };
}
