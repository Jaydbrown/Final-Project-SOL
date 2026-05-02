import type { Channel, ConsumeMessage } from 'amqplib';

import { DEFAULT_MAX_JOB_ATTEMPTS, HEADER_RETRY_COUNT, JOB_EXCHANGE } from '../constants';

/**
 * Application-level retry: republish the identical body with an incremented header.
 * When retries are exhausted, broker dead-letters original message into the configured DLQ via `nack`.
 *
 * Note: we ACK the original delivery after a successful republish to avoid double-processing
 * in the face of at-least-once delivery guarantees.
 */
export async function requeueOrDeadLetter(opts: {
  channel: Channel;
  msg: ConsumeMessage;
  routingKey: string;
  err: unknown;
}): Promise<void> {
  const retries = Number(opts.msg.properties.headers?.[HEADER_RETRY_COUNT] ?? 0);
  const max = DEFAULT_MAX_JOB_ATTEMPTS;

  const detail = opts.err instanceof Error ? opts.err.message : String(opts.err);
  console.error(`[rabbit worker] failure after ${retries} prior attempts:`, detail);

  if (retries + 1 < max) {
    const headers = {
      ...(opts.msg.properties.headers as Record<string, unknown> | undefined),
      [HEADER_RETRY_COUNT]: retries + 1,
    };

    opts.channel.publish(JOB_EXCHANGE, opts.routingKey, opts.msg.content, {
      persistent: true,
      headers,
    });
    opts.channel.ack(opts.msg);
    return;
  }

  opts.channel.nack(opts.msg, false, false);
}
