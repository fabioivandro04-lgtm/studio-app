import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';

describe('cabeçalhos de segurança', () => {
  it('a página de autorização do Claude não pode ser mostrada dentro de outro site', async () => {
    const rules = await nextConfig.headers!();
    const oauth = rules.find((r) => r.source === '/oauth/:path*');
    expect(oauth?.headers).toEqual(expect.arrayContaining([
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
      { key: 'X-Frame-Options', value: 'DENY' },
    ]));
  });
});
