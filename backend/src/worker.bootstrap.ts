import 'dotenv/config';

import { consumeChatDispatcher } from './messaging/consumers/chatDispatch.consumer';
import { consumeEmailDeliverer } from './messaging/consumers/emailDeliver.consumer';
import { connectWorkerChannel } from './messaging/connection';

const prefetch = Number(process.env.RABBIT_PREFETCH ?? 32);

async function bootstrap() {
  if (!process.env.RABBITMQ_URL?.trim()) {
    console.error('Set RABBITMQ_URL before running workers.');
    process.exit(1);
  }

  const { connection, channel } = await connectWorkerChannel();

  await channel.prefetch(Number.isFinite(prefetch) ? Math.max(1, prefetch) : 32);

  await consumeChatDispatcher(channel);
  await consumeEmailDeliverer(channel);

  console.log(
    `[worker-bootstrap] Ready — prefetch=${prefetch}. Queues:` +
      ' chat dispatcher + SMTP deliverer.',
  );

  const shutdown = async (signal: string) => {
    console.warn(`[worker-bootstrap] ${signal} shutting down Rabbit consumers…`);
    try {
      await channel.close();
    } catch {
      /* noop */
    }
    try {
      await connection.close();
    } catch {
      /* noop */
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
