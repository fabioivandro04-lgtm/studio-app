import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { describe, expect, it } from 'vitest';
import { createMcpRoute } from './route-handler';

const verify = async (_req: Request, bearer?: string) => (bearer === 'bom' ? { token: 'bom', clientId: 'c', scopes: [], extra: { userId: 'u' } } : undefined);
const handler = createMcpRoute(verify);

describe('rota /api/mcp', () => {
  it('sem token → 401 com resource_metadata', async () => {
    const res = await handler(new Request('https://app.test/api/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata="https://app.test/.well-known/oauth-protected-resource/api/mcp"');
  });

  it('com token válido lista as ferramentas', async () => {
    const client = new Client({ name: 'teste', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://app.test/api/mcp'), {
      fetch: (input: string | URL | Request, init?: RequestInit) => handler(new Request(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), authorization: 'Bearer bom' } })),
    });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('marcas');
    await client.close();
  });
});
