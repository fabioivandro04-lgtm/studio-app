import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';
import { clientEnv, serverEnv } from '@/lib/env';

/** Caminho da metadata RFC 9728 do recurso /api/mcp (usado no WWW-Authenticate). */
export const MCP_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource/api/mcp';

/** Servidor de autorização = Supabase Auth (OAuth 2.1). */
export const authServerUrl = () => `${clientEnv.supabaseUrl}/auth/v1`;

export function metadataGet(req: Request): Response {
  return protectedResourceHandler({ authServerUrls: [authServerUrl()], resourceUrl: `${serverEnv().APP_URL}/api/mcp` })(req);
}

export const metadataOptions = metadataCorsOptionsRequestHandler();
