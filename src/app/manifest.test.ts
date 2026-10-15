import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('manifest', () => {
  it('PWA em português, standalone, com as cores da marca e ícones 192/512', () => {
    const m = manifest();
    expect(m).toMatchObject({ name: 'Estúdio', lang: 'pt-PT', display: 'standalone', theme_color: '#0B1F45', background_color: '#0B1F45', start_url: '/calendario' });
    expect(m.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
  });
});
