import type { Channel } from 'amqplib';
import {
  DLX_EXCHANGE,
  DeadLetterRoutingKeys,
  JOB_EXCHANGE,
  QueueNames,
  RoutingKeys,
} from './constants';

/**
 * Declares exchanges, durable queues, dead-letter bindings, and main bindings.
 *
 * Idempotent — safe for multiple processes (workers + API publishers) during deployment.
 *
 * DLQ flow:
 * 1. A consumer rejects a message (`nack(..., false)`) without re-queueing — or TTL expires —
 *    the broker publishes to DLX (`localdao.dlx`) with routing key `*.failed`.
 * 2. The corresponding DL queue is bound exclusively to those keys — operators can purge/replay/review.
 *
 * Operational tips:
 * - Use RabbitMQ Management UI (`docker-compose.rabbitmq.yml` exposes 15672) to peek DLQs.
 * - Replay: move/move-to-main via plugin or shovel; or point a replay script at DLQ consume + republish.
 */
export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(JOB_EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DLX_EXCHANGE, 'direct', { durable: true });

  // --- Chat dispatcher queue + DLQ
  await channel.assertQueue(QueueNames.CHAT_MESSAGE_RECEIVED_DLQ, {
    durable: true,
    // No DLX on DLQs to avoid infinite chaining.
  });
  await channel.bindQueue(
    QueueNames.CHAT_MESSAGE_RECEIVED_DLQ,
    DLX_EXCHANGE,
    DeadLetterRoutingKeys.CHAT_MESSAGE_FAILED,
  );

  await channel.assertQueue(QueueNames.CHAT_MESSAGE_RECEIVED, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_EXCHANGE,
      'x-dead-letter-routing-key': DeadLetterRoutingKeys.CHAT_MESSAGE_FAILED,
    },
  });
  await channel.bindQueue(
    QueueNames.CHAT_MESSAGE_RECEIVED,
    JOB_EXCHANGE,
    RoutingKeys.CHAT_MESSAGE_RECEIVED,
  );

  // --- Per-email outbound queue + DLQ
  await channel.assertQueue(QueueNames.EMAIL_DELIVER_DLQ, {
    durable: true,
  });
  await channel.bindQueue(
    QueueNames.EMAIL_DELIVER_DLQ,
    DLX_EXCHANGE,
    DeadLetterRoutingKeys.EMAIL_DELIVER_FAILED,
  );

  await channel.assertQueue(QueueNames.EMAIL_DELIVER, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX_EXCHANGE,
      'x-dead-letter-routing-key': DeadLetterRoutingKeys.EMAIL_DELIVER_FAILED,
    },
  });
  await channel.bindQueue(
    QueueNames.EMAIL_DELIVER,
    JOB_EXCHANGE,
    RoutingKeys.NOTIFICATION_EMAIL_DELIVER,
  );
}
