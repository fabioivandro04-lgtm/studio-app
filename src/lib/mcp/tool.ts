import type { CallToolResult } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import type { McpCtx } from './context';

export interface ToolDef<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** Só lê dados (anotação readOnlyHint para o cliente). */
  readOnly?: boolean;
  run(args: z.infer<S>, ctx: McpCtx): Promise<CallToolResult>;
}

export const defineTool = <S extends z.ZodObject>(t: ToolDef<S>): ToolDef<S> => t;
