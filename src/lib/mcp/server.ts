import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { ctxFrom, type McpCtx } from './context';
import { fail, ToolError } from './result';
import type { ToolDef } from './tool';
import { TOOLS } from './tools';

export const INSTRUCTIONS =
  'Estúdio: planeador de posts (Instagram, TikTok, YouTube Shorts) do dono. Comece por "marcas" para saber ids, fusos e contas. ' +
  'Datas AAAA-MM-DD e horas HH:MM no fuso da marca. Tudo o que cria fica como rascunho: o dono revê e agenda na app. ' +
  'Antes de criar, use "horarios_livres" e "verificar_post". Junte os ficheiros de um carrossel numa pasta com o tema do post ' +
  '("criar_pasta" e pastaId no envio). Responda ao dono em português de Portugal.';

/** Corre uma ferramenta: limite de pedidos, validação da entrada e erros sem detalhes internos. */
export async function runTool(tool: ToolDef, raw: unknown, ctx: McpCtx): Promise<CallToolResult> {
  if (!ctx.take(ctx.rateKey, ctx.now().getTime())) return fail('Muitos pedidos, aguarde um minuto.');
  const parsed = tool.input.safeParse(raw ?? {});
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join(' '));
  try {
    return await tool.run(parsed.data, ctx);
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message);
    console.error(`mcp:${tool.name}`, (e as Error).message);
    return fail('Ocorreu um erro. Tente de novo.');
  }
}

export function registerTools(server: McpServer, tools: ToolDef[] = TOOLS): void {
  for (const t of tools) {
    server.registerTool(
      t.name,
      { title: t.title, description: t.description, inputSchema: t.input, annotations: { readOnlyHint: !!t.readOnly, destructiveHint: false } },
      async (args: unknown, ctx) => {
        const auth = ctx.http?.authInfo;
        if (!auth) return fail('Sem autorização.');
        return runTool(t, args, ctxFrom(auth));
      },
    );
  }
}
