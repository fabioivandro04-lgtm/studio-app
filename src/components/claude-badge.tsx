import { Bot } from 'lucide-react';

/** Etiqueta para rascunhos criados pelo Claude (MCP). */
export function ClaudeBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground" data-testid="claude-badge">
      <Bot className="size-3.5" aria-hidden />
      Criado pelo Claude
    </span>
  );
}
