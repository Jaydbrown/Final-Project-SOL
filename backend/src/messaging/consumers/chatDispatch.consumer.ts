import type { Channel, ConsumeMessage } from 'amqplib';

import { processChatMessageDispatch } from '../../services/chat-notification.processor';
import { QueueNames, RoutingKeys } from '../constants';
import type { ChatMessageReceivedPayload } from '../types';
import { parseJson } from '../types';
import { requeueOrDeadLetter } from './requeue.helper';

/**
 * Consumer for `localdao.q.chat.message.received`.
 *
 * **At-least-once semantics:** if the process crashes after creating DB rows but before `ack`,
 * the job will be redelivered (duplicate notifications unless you add an idempotency key — future work).
 */
export async function consumeChatDispatcher(channel: Channel): Promise<void> {
  await channel.consume(QueueNames.CHAT_MESSAGE_RECEIVED, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    let payload: ChatMessageReceivedPayload;
    try {
      payload = parseJson<ChatMessageReceivedPayload>(msg.content);
    } catch (parseErr) {
      console.error('[rabbit] Malformed chat message JSON — dead-lettering:', parseErr);
      channel.nack(msg, false, false);
      return;
    }

    if (payload.v !== 1 || typeof payload.daoAddress !== 'string') {
      console.error('[rabbit] Unsupported payload version or missing daoAddress');
      channel.nack(msg, false, false);
      return;
    }

    try {
      await processChatMessageDispatch(payload, channel, { mode: 'queue' });
      channel.ack(msg);
    } catch (err) {
      await requeueOrDeadLetter({
        channel,
        msg,
        routingKey: RoutingKeys.CHAT_MESSAGE_RECEIVED,
        err,
      });
    }
  });
}
