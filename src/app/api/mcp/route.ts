import { verifyMcpToken } from '@/lib/mcp/auth';
import { createMcpRoute } from '@/lib/mcp/route-handler';

export const maxDuration = 60;

const handler = createMcpRoute((req, bearer) => verifyMcpToken(req, bearer));
export { handler as DELETE, handler as GET, handler as POST };
