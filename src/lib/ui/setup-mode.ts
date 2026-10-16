/** Como mostrar "Primeiros passos": cartão completo, uma linha (falta 1 passo) ou nada. */
export function setupMode(done: number, total: number, dismissed: boolean): 'full' | 'compact' | 'hidden' {
  if (done >= total) return 'hidden';
  if (done === total - 1) return dismissed ? 'hidden' : 'compact';
  return 'full';
}
