import { describe, expect, it } from 'vitest';
import { aiPlatformsFor, appendHashtags, restoreCaptions, setCaption, snapshotCaptions } from './caption-edits';

const t = (accountId: string, caption: string) => ({ accountId, caption, format: 'ig_image' as const, title: null });

describe('edições de legendas da IA', () => {
  it('setCaption só altera a conta indicada', () => {
    const r = setCaption([t('ig', 'a'), t('tt', 'b')], 'tt', 'novo');
    expect(r.map((x) => x.caption)).toEqual(['a', 'novo']);
  });

  it('desfazer repõe só as legendas guardadas e mantém edições posteriores noutras redes', () => {
    const before = [t('ig', 'original IG'), t('tt', 'original TT')];
    const snap = snapshotCaptions(before, ['ig']);
    let now = setCaption(before, 'ig', 'versão IA'); // a IA mudou o IG
    now = setCaption(now, 'tt', 'editado à mão depois'); // o utilizador mudou o TikTok entretanto
    const undone = restoreCaptions(now, snap);
    expect(undone.map((x) => x.caption)).toEqual(['original IG', 'editado à mão depois']);
  });

  it('desfazer remove um destino que a IA acrescentou', () => {
    const before = [t('ig', 'x')];
    const snap = snapshotCaptions(before, ['tt']);
    const added = [...before, t('tt', 'nova')];
    expect(restoreCaptions(added, snap).map((x) => x.accountId)).toEqual(['ig']);
  });

  it('dois resultados da IA em redes diferentes não se apagam um ao outro', () => {
    const start = [t('ig', 'a'), t('tt', 'b')];
    const afterIg = setCaption(start, 'ig', 'IA ig');
    const afterTt = setCaption(afterIg, 'tt', 'IA tt'); // aplicado sobre o estado atual, não sobre o antigo
    expect(afterTt.map((x) => x.caption)).toEqual(['IA ig', 'IA tt']);
  });
});

describe('appendHashtags', () => {
  it('acrescenta só as que faltam, comparando a hashtag inteira sem maiúsculas', () => {
    expect(appendHashtags('Olá #bolsasdeestudo', ['#bolsas'])).toBe('Olá #bolsasdeestudo\n\n#bolsas');
    expect(appendHashtags('Olá #Bolsas', ['#bolsas'])).toBe('Olá #Bolsas');
    expect(appendHashtags('', ['#a', '#b'])).toBe('#a #b');
  });
});

describe('aiPlatformsFor', () => {
  it('usa as redes marcadas; sem nenhuma, só as contas ativas', () => {
    const accounts = [
      { platform: 'instagram' as const, status: 'active' },
      { platform: 'tiktok' as const, status: 'needs_reauth' },
      { platform: 'instagram' as const, status: 'active' },
    ];
    expect(aiPlatformsFor(['youtube'], accounts)).toEqual(['youtube']);
    expect(aiPlatformsFor([], accounts)).toEqual(['instagram']);
  });
});
