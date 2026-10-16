/** Há números de posts para mostrar? (senão a página mostra um estado vazio em vez de zeros) */
export const hasPostMetrics = (rows: readonly unknown[]): boolean => rows.length > 0;

/** Um gráfico com 1 só dia não diz nada: só a partir de 2 dias. */
export const showFollowersChart = (series: readonly { day: string | number }[]): boolean => series.length >= 2;
