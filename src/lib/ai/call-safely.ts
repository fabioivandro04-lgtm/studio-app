export const CONNECTION_LOST = 'A ligação falhou ou a IA demorou demasiado. Tente de novo.';

/**
 * Chama uma server action sem deixar uma falha de rede/tempo limite rebentar o ecrã
 * (o que apagaria o post que está a ser escrito).
 */
export async function callSafely<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch {
    return { ok: false, error: CONNECTION_LOST };
  }
}
