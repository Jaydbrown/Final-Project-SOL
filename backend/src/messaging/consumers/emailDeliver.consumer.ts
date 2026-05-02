import type { Channel, ConsumeMessage } from 'amqplib';

import {
  isNotificationAlreadyEmailed,
  processEmailDeliverJob,
} from '../../services/chat-notification.processor';
import { QueueNames, RoutingKeys } from '../constants';
import type { EmailDeliverPayload } from '../types';
import { parseJson } from '../types';
import { requeueOrDeadLetter } from './requeue.helper';

/**
 * Sends one transactional email derived from persisted `Notification` metadata.
 *
 * Poison messages (missing rows) ACK to avoid clogging retries — operators should inspect DLQ content.
 */

export async function consumeEmailDeliverer(channel: Channel): Promise<void> {
  await channel.consume(QueueNames.EMAIL_DELIVER, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    let payload: EmailDeliverPayload;
    try {
      payload = parseJson<EmailDeliverPayload>(msg.content);
    } catch (parseErr) {
      console.error('[rabbit] Email job JSON malformed — dead-lettering:', parseErr);
      channel.nack(msg, false, false);
      return;
    }

    if (payload.v !== 1 || !payload.notificationId || !payload.recipientEmail?.trim()) {
      channel.nack(msg, false, false);
      return;
    }

    try {
      if (await isNotificationAlreadyEmailed(payload.notificationId)) {
        channel.ack(msg);
        return;
      }
      await processEmailDeliverJob(payload);
      channel.ack(msg);
    } catch (err) {
      await requeueOrDeadLetter({
        channel,
        msg,
        routingKey: RoutingKeys.NOTIFICATION_EMAIL_DELIVER,
        err,
      });
    }
  });
}
