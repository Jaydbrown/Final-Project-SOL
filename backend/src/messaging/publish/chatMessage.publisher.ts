import { randomUUID } from 'crypto';

import { getPublishChannel } from '../connection';
import { JOB_EXCHANGE, RoutingKeys } from '../constants';
import type { ChatMessageReceivedPayload } from '../types';
import { stringifyPayload } from '../types';

export type ChatEnqueueInput = Omit<ChatMessageReceivedPayload, 'v' | 'correlationId'> & {
  correlationId?: string;
};

/**
 * Publishes a durable job consumed by {@link ../../messaging/consumers/chatDispatch.consumer}.
 *
 * Brokers may apply back-pressure (`publish` returning `false`). We honour `channel.drain`.
 */
export async function enqueueChatWebhookJob(fields: ChatEnqueueInput): Promise<{ correlationId: string }> {
  const correlationId = fields.correlationId ?? randomUUID();
  const payload: ChatMessageReceivedPayload = {
    v: 1,
    correlationId,
    daoAddress: fields.daoAddress,
    daoName: fields.daoName,
    message: fields.message,
    senderWallet: fields.senderWallet,
    senderName: fields.senderName,
    timestamp: fields.timestamp ?? Date.now(),
  };

  const channel = await getPublishChannel();
  const buf = stringifyPayload(payload);

  const flushed = channel.publish(JOB_EXCHANGE, RoutingKeys.CHAT_MESSAGE_RECEIVED, buf, {
    persistent: true,
    contentType: 'application/json',
    correlationId,
  });

  if (!flushed) {
    await new Promise<void>((resolve) => channel.once('drain', () => resolve()));
  }

  console.log('[rabbit enqueue] Chat message dispatched', correlationId);
  return { correlationId };
}
