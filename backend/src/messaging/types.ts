/**
 * Queue payload contracts (JSON bodies). Bump `v` when making breaking schema changes.
 */

export type ChatMessageReceivedPayload = {
  v: 1;
  /** Returned to HTTP client for support / tracing. */
  correlationId: string;
  daoAddress: string;
  daoName: string;
  message: string;
  senderWallet: string;
  senderName: string;
  timestamp: number;
};

/** Small payload — full copy lives in Notification.data until email succeeds. */
export type EmailDeliverPayload = {
  v: 1;
  correlationId: string;
  notificationId: string;
  recipientEmail: string;
};

export function parseJson<T>(buffer: Buffer): T {
  const s = buffer.toString('utf8');
  return JSON.parse(s) as T;
}

export function stringifyPayload<T>(payload: T): Buffer {
  return Buffer.from(JSON.stringify(payload), 'utf8');
}
