import { hasUnsavedChanges } from './dirty';

type Snapshot = Parameters<typeof hasUnsavedChanges>[0];
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface LocalDraft<T> { savedAt: number; value: T }

const MAX_AGE_MS = 7 * 86_400_000;

/** Chave no navegador para as alterações ainda não guardadas de um post (ou do post novo). */
export const localDraftKey = (postId: string | null, brandId = '') => (postId ? `estudio:rascunho:${postId}` : `estudio:rascunho:novo:${brandId}`);

/**
 * O que fazer com a gravação local: 'skip' enquanto o estado é o mesmo objeto vindo do servidor (ainda sem
 * edições — não apaga um rascunho que ainda não foi recuperado nem descartado), 'write' com alterações,
 * 'clear' quando o dono voltou ao que está guardado.
 */
export function draftAction<T extends Snapshot>(current: T, saved: T): 'skip' | 'write' | 'clear' {
  if (current === saved) return 'skip';
  return hasUnsavedChanges(saved, current) ? 'write' : 'clear';
}

export function writeLocalDraft<T extends Snapshot>(store: Store, key: string, value: T, now: number): void {
  try {
    store.setItem(key, JSON.stringify({ savedAt: now, value }));
  } catch {
    // Sem espaço ou navegação privada: a gravação local é só uma ajuda.
  }
}

/** Rascunho local a oferecer para recuperar: só se existir, for recente e diferente do que está guardado. */
export function readLocalDraft<T extends Snapshot>(store: Store, key: string, saved: T, now: number): LocalDraft<T> | null {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as LocalDraft<T>;
    if (typeof d?.savedAt !== 'number' || !d.value || now - d.savedAt > MAX_AGE_MS) return null;
    return hasUnsavedChanges(saved, d.value) ? d : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft(store: Store, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // ignorar
  }
}
