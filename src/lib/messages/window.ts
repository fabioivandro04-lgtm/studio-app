import type { DmMessage } from './types';

/** O Instagram só deixa responder até 24 h depois da última mensagem do cliente. */
export const REPLY_WINDOW_MS = 24 * 60 * 60_000;

export interface ReplyWindow {
  open: boolean;
  /** Quando deixa de ser possível responder (null se o cliente nunca escreveu). */
  closesAt: Date | null;
}

export function replyWindow(messages: DmMessage[], now: Date): ReplyWindow {
  const lastCustomer = messages.reduce<Date | null>(
    (acc, m) => (!m.fromBusiness && (!acc || m.createdAt > acc) ? m.createdAt : acc),
    null,
  );
  if (!lastCustomer) return { open: false, closesAt: null };
  const closesAt = new Date(lastCustomer.getTime() + REPLY_WINDOW_MS);
  return { open: closesAt > now, closesAt };
}
