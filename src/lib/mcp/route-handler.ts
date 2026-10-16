import type { AuthInfo } from '@modelcontextprotocol/server';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { MCP_RESOURCE_METADATA_PATH } from './metadata';
import { INSTRUCTIONS, registerTools } from './server';

type Verify = (req: Request, bearer?: string) => Promise<AuthInfo | undefined>;

/** Handler MCP (Streamable HTTP, sem estado) protegido por OAuth. */
export function createMcpRoute(verify: Verify) {
  const handler = createMcpHandler((server) => registerTools(server), {
    serverInfo: { name: 'estudio', version: '1.0.0' },
    instructions: INSTRUCTIONS,
  });
  return withMcpAuth(handler, verify, { required: true, resourceMetadataPath: MCP_RESOURCE_METADATA_PATH });
}
