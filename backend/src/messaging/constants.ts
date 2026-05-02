/**
 * RabbitMQ naming: all resources are prefixed with `localdao` to avoid clashes in shared brokers.
 *
 * Topology (high level):
 *
 *   [ API / producers ] ──► exchange `localdao.jobs` (direct)
 *                                    │
 *                    ┌──────────────┼────────────────┐
 *                    ▼                             ▼
 *   queue `localdao.q.chat.message.received`   queue `localdao.q.notifications.email.deliver`
 *   (dead-letters ──►)                         (dead-letters ──►)
 *                    │                             │
 *                    ▼                             ▼
 *   exchange `localdao.dlx` (direct) ◄────────────────┘
 *                    │
 *        ┌───────────┴────────────┐
 *        ▼                        ▼
 *   `.dlq` chat queues      `.dlq` email queues
 */

export const JOB_EXCHANGE = 'localdao.jobs';

/** Dead-letter exchange: failed messages arrive here after reject/nack(no requeue) or TTL expiry. */
export const DLX_EXCHANGE = 'localdao.dlx';

export const RoutingKeys = {
  /** One job per inbound chat webhook: fan-out to DB + optional email jobs happens in the dispatch worker. */
  CHAT_MESSAGE_RECEIVED: 'chat.message.received',
  /** One job per outbound email attempt (SMTP / Gmail OAuth). */
  NOTIFICATION_EMAIL_DELIVER: 'notifications.email.deliver',
} as const;

export const QueueNames = {
  CHAT_MESSAGE_RECEIVED: 'localdao.q.chat.message.received',
  CHAT_MESSAGE_RECEIVED_DLQ: 'localdao.q.chat.message.received.dlq',

  EMAIL_DELIVER: 'localdao.q.notifications.email.deliver',
  EMAIL_DELIVER_DLQ: 'localdao.q.notifications.email.deliver.dlq',
} as const;

/** Routing keys used only on `DLX_EXCHANGE` to route into DLQs. */
export const DeadLetterRoutingKeys = {
  CHAT_MESSAGE_FAILED: 'chat.message.failed',
  EMAIL_DELIVER_FAILED: 'notifications.email.failed',
} as const;

/** Message header for application-level retries before dead-lettering. */
export const HEADER_RETRY_COUNT = 'x-localdao-retry-count';

/** Default max retries inside the worker before nack → DLX (excluding broker-level redelivery). */
export const DEFAULT_MAX_JOB_ATTEMPTS = Number(process.env.RABBIT_MAX_JOB_ATTEMPTS ?? 5);
