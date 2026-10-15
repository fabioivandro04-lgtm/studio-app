import { nextMidnightIn } from '@/lib/time/zone';
import { AuthError, DeferError, PermanentError, TransientError } from './errors';
import { PLATFORM_LABEL, type Platform } from './types';

export interface HttpResult<T> {
  status: number;
  headers: Headers;
  body: T;
}

type Init = RequestInit & { platform: Platform; now?: () => Date };

const TIKTOK_AUTH_CODES = new Set(['access_token_invalid', 'access_token_expired', 'scope_not_authorized']);

/* eslint-disable @typescript-eslint/no-explicit-any */
function apiMessage(body: any): string {
  return (
    body?.error?.message ??
    body?.error?.error_user_msg ??
    body?.error_description ??
    body?.message ??
    (typeof body?.error === 'string' ? body.error : '') ??
    ''
  );
}

/** Pedido HTTP com classificação dos erros nas classes de `errors.ts`. 2xx e 308 são sucesso. */
export async function requestJson<T = any>(fetchFn: typeof fetch, url: string, init: Init): Promise<HttpResult<T>> {
  const { platform, now = () => new Date(), ...rest } = init;
  const label = PLATFORM_LABEL[platform];
  let res: Response;
  try {
    res = await fetchFn(url, rest);
  } catch (e) {
    throw new TransientError(`${label}: ${(e as Error).message}`, `Erro de rede ao contactar o ${label}.`);
  }

  const text = await res.text();
  let body: any = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  const msg = apiMessage(body);
  const detail = msg ? `: ${msg}` : '';

  if (platform === 'instagram' && body?.error?.code === 190) {
    throw new AuthError(`${label} token inválido${detail}`, `A ligação ao ${label} expirou. Volte a ligar a conta.`);
  }
  if (platform === 'tiktok' && body?.error?.code && body.error.code !== 'ok') {
    if (TIKTOK_AUTH_CODES.has(body.error.code)) {
      throw new AuthError(`${label} ${body.error.code}`, `A ligação ao ${label} expirou. Volte a ligar a conta.`);
    }
    if (res.ok) throw new PermanentError(`${label} ${body.error.code}${detail}`, `${label} recusou o pedido${detail}`);
  }
  if (platform === 'youtube' && res.status === 403) {
    const reasons: string[] = (body?.error?.errors ?? []).map((e: any) => e.reason);
    if (reasons.includes('quotaExceeded') || reasons.includes('dailyLimitExceeded')) {
      throw new DeferError(
        `${label} quota esgotada`,
        nextMidnightIn('America/Los_Angeles', now()),
        'A quota diária do YouTube acabou. O envio continua depois da meia-noite (hora da Califórnia).',
      );
    }
  }

  if (res.ok || res.status === 308) return { status: res.status, headers: res.headers, body: body as T };

  if (res.status === 401) {
    throw new AuthError(`${label} 401${detail}`, `A ligação ao ${label} expirou. Volte a ligar a conta.`);
  }
  if (res.status === 429 || res.status >= 500) {
    throw new TransientError(`${label} ${res.status}${detail}`, `O ${label} está temporariamente indisponível (${res.status}).`);
  }
  throw new PermanentError(`${label} ${res.status}${detail}`, `${label} recusou o pedido${detail}`);
}
