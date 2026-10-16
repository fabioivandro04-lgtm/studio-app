import type { CallToolResult } from '@modelcontextprotocol/server';

/** Resposta de sucesso: texto curto em pt-PT para o Claude + dados estruturados. */
export function ok(text: string, data?: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], ...(data ? { structuredContent: data } : {}) };
}

export function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export class ToolError extends Error {}
