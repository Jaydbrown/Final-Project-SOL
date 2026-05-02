import amqp from 'amqplib';

import { assertTopology } from './topology';

/** `amqplib.connect()` resolves to ChannelModel (wrapper with `createChannel`). */
let sharedConnection: amqp.ChannelModel | null = null;
let publishChannel: amqp.Channel | null = null;

/** Whether we already logged a degraded-mode warning once. */
let warnedMissingEnv = false;

export function rabbitUrlConfigured(): boolean {
  const url = process.env.RABBITMQ_URL?.trim();
  return Boolean(url);
}

async function attachChannelListeners(ch: amqp.Channel): Promise<void> {
  ch.on('error', (err: Error) => {
    console.error('[rabbit publish channel] Error:', err.message);
    publishChannel = null;
  });
  ch.on('close', () => {
    console.warn('[rabbit publish channel] Closed');
    publishChannel = null;
  });
}

/**
 * Returns the shared publish channel — creates topology on first open.
 *
 * Throws if `RABBITMQ_URL` is unset (caller falls back to sync processing).
 */
export async function getPublishChannel(): Promise<amqp.Channel> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) throw new Error('RABBITMQ_URL is not configured');

  if (!sharedConnection || !publishChannel) {
    const heartbeat = Number(process.env.RABBITMQ_HEARTBEAT ?? 30);
    sharedConnection = await amqp.connect(url, { heartbeat });

    sharedConnection.on('error', (err: Error) => {
      console.error('[rabbit] Connection error:', err.message);
      sharedConnection = null;
      publishChannel = null;
    });
    sharedConnection.on('close', () => {
      console.warn('[rabbit] Connection closed');
      sharedConnection = null;
      publishChannel = null;
    });

    const ch = await sharedConnection.createChannel();
    await assertTopology(ch);
    await attachChannelListeners(ch);

    publishChannel = ch;
  }

  if (!publishChannel) {
    throw new Error('Failed to open RabbitMQ publish channel.');
  }
  return publishChannel;
}

/**
 * Worker entry: isolate connection/channel from API lifecycle (recommended production pattern).
 *
 * Consumers should prefetch (see WORKER prefetch env) before registering handlers.
 */
export async function connectWorkerChannel(): Promise<{
  connection: amqp.ChannelModel;
  channel: amqp.Channel;
}> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    throw new Error('Worker requires RABBITMQ_URL to be configured.');
  }
  const heartbeat = Number(process.env.RABBITMQ_HEARTBEAT ?? 30);
  const connection = await amqp.connect(url, { heartbeat });
  const channel = await connection.createChannel();
  await assertTopology(channel);

  connection.on('error', (err: Error) =>
    console.error('[rabbit-worker] Connection error:', err.message),
  );
  channel.on('error', (err: Error) =>
    console.error('[rabbit-worker] Channel error:', err.message),
  );

  return { connection, channel };
}

export async function closePublishConnectionGracefully(): Promise<void> {
  try {
    if (publishChannel) {
      await publishChannel.close().catch(() => undefined);
      publishChannel = null;
    }
    if (sharedConnection) {
      await sharedConnection.close().catch(() => undefined);
      sharedConnection = null;
    }
  } catch {
    /* noop */
  }
}

/** Best-effort check for readiness (returns false if Rabbit is down/unconfigured without throwing far). */
export async function rabbitHealthCheck(): Promise<{
  ok: boolean;
  configured: boolean;
  error?: string;
}> {
  if (!rabbitUrlConfigured()) {
    if (!warnedMissingEnv && process.env.NODE_ENV !== 'test') {
      console.warn('[rabbit] RABBITMQ_URL unset — webhook uses synchronous fallback.');
      warnedMissingEnv = true;
    }
    return { ok: false, configured: false, error: 'RABBITMQ_URL not set' };
  }
  try {
    const heartbeat = Number(process.env.RABBITMQ_HEARTBEAT ?? 10);
    const url = process.env.RABBITMQ_URL!.trim();
    const ping = await amqp.connect(url, { heartbeat }).catch(() => null);
    if (!ping) return { ok: false, configured: true, error: 'connect_failed' };
    await ping.close();
    return { ok: true, configured: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, configured: true, error: msg };
  }
}
