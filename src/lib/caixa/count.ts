/** Número no menu "Caixa": tudo o que espera pelo dono. */
export function inboxCount(c: { awaiting: number; failed: number; claudeDrafts: number }): number {
  return Math.max(0, c.awaiting) + Math.max(0, c.failed) + Math.max(0, c.claudeDrafts);
}
