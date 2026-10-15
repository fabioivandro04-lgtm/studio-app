/** fetch falso para testes dos adaptadores. Cada rota responde com um objeto JSON ou um Response. */
export interface FakeCall {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** Parâmetros: query string + corpo form-urlencoded/JSON fundidos. */
  params: Record<string, unknown>;
}

type Responder = (call: FakeCall) => Response | object | Promise<Response | object>;
export type Route = [method: string, url: RegExp, respond: Responder];

export type FakeFetch = typeof fetch & { calls: FakeCall[]; routes: Route[] };

export function fakeFetch(routes: Route[]): FakeFetch {
  const calls: FakeCall[] = [];
  const fn = (async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    let body: unknown = init.body;
    const params: Record<string, unknown> = Object.fromEntries(new URL(url).searchParams);
    if (init.body instanceof URLSearchParams) {
      body = Object.fromEntries(init.body);
      Object.assign(params, body);
    } else if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
        if (body && typeof body === 'object') Object.assign(params, body);
      } catch {
        /* texto simples */
      }
    }
    const call: FakeCall = { method, url, headers, body, params };
    calls.push(call);
    const route = fn.routes.find(([m, re]) => m === method && re.test(url));
    if (!route) throw new Error(`fakeFetch: sem rota para ${method} ${url}`);
    const out = await route[2](call);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as FakeFetch;
  fn.calls = calls;
  fn.routes = routes;
  return fn;
}

export const jsonResponse = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
