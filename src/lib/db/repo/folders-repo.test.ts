import { describe, expect, it } from 'vitest';
import { fakeDb } from '@/lib/mcp/testing/fake-db';
import { listFolders, mediaUsage } from './folders-repo';

const B = '11111111-1111-4111-8111-111111111111';

describe('listFolders', () => {
  it('usa media_folder_stats e conta os soltos sem carregar todos os ficheiros', async () => {
    const signed: string[][] = [];
    const { db } = fakeDb(
      {
        media_folders: [{ id: 'f1', brand_id: B, name: 'Prazos', notes: 'n', created_at: '2026-10-01' }],
        media_assets: [{ id: 'm1', brand_id: B, folder_id: 'f1' }, { id: 'm2', brand_id: B, folder_id: null }, { id: 'm3', brand_id: B, folder_id: null }],
      },
      {
        rpc: { media_folder_stats: () => [{ folder_id: 'f1', files: 1, used_in: 3, previews: ['b/1.jpg'] }] },
        storage: { createSignedUrls: async (ps: string[]) => (signed.push(ps), { data: ps.map((p) => ({ path: p, signedUrl: `https://s/${p}` })) }) },
      },
    );
    const r = await listFolders(db, B);
    expect(r.looseCount).toBe(2);
    expect(r.folders).toMatchObject([{ id: 'f1', name: 'Prazos', count: 1, usedIn: 3, previews: ['https://s/b/1.jpg'] }]);
  });
});

describe('mediaUsage', () => {
  it('pede em lotes de 100 ids (URLs curtos) e junta o resultado', async () => {
    const { db } = fakeDb({
      post_media: [
        { media_id: 'id-5', post_id: 'p1', posts: { internal_title: 'A', status: 'draft', scheduled_at: null } },
        { media_id: 'id-205', post_id: 'p2', posts: { internal_title: 'B', status: 'draft', scheduled_at: null } },
      ],
    });
    let n = 0;
    const counting = { ...db, from: (t: string) => (t === 'post_media' && n++, db.from(t)) } as typeof db;
    const u = await mediaUsage(counting, Array.from({ length: 250 }, (_, i) => `id-${i}`));
    expect(n).toBe(3);
    expect([...u.keys()].sort()).toEqual(['id-205', 'id-5']);
  });
});
