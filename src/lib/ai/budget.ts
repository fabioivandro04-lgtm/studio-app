import { AiError } from './errors';

/** Início do mês civil em UTC (ISO), usado para somar os gastos do mês. */
export function monthStartUtc(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function assertWithinBudget(spentUsd: number, limitUsd: number): void {
  if (spentUsd >= limitUsd) {
    throw new AiError('budget', `Chegou ao limite mensal de IA (${limitUsd} USD). Aumente em Definições → IA.`);
  }
}
