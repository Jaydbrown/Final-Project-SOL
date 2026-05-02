/**
 * Heavy chat-notification orchestration shared by:
 * - RabbitMQ workers (recommended)
 * - Synchronous webhook fallback when the broker or publisher is unavailable
 *
 * Persistence model:
 * - One `Notification` row per subscribing user per inbound chat webhook (already filtered from sender).
 * - Optional SMTP work is represented by enqueueing `notifications.email.deliver` jobs (one per inbox).
 */

import type { Channel } from 'amqplib';

import { prisma } from '../db/prisma';
import { stringifyPayload } from '../messaging/types';
import type { ChatMessageReceivedPayload, EmailDeliverPayload } from '../messaging/types';
import { JOB_EXCHANGE, RoutingKeys } from '../messaging/constants';
import { GmailService } from './gmail.service';

const gmailMailer = new GmailService();

export async function publishEmailDeliverJob(
  channel: Channel,
  job: EmailDeliverPayload,
): Promise<void> {
  const buf = stringifyPayload(job);
  const flushed = channel.publish(JOB_EXCHANGE, RoutingKeys.NOTIFICATION_EMAIL_DELIVER, buf, {
    persistent: true,
    contentType: 'application/json',
  });
  if (!flushed) {
    await new Promise<void>((resolve) => channel.once('drain', () => resolve()));
  }
}

export type DispatchOutcome = {
  subscriberCount: number;
  inAppNotifications: number;
  emailJobsPublished: number;
};

/**
 * Fan-out persistence + enqueue outbound mail (when `channel` exists and mode is `'queue'`).
 *
 * `'sync'` mode sends mail inline (SMTP path) — only used when `RabbitMQ_URL` is unset or enqueue fails.
 */
export async function processChatMessageDispatch(
  payload: ChatMessageReceivedPayload,
  channel: Channel | null,
  options: { mode: 'queue' | 'sync' },
): Promise<DispatchOutcome> {
  const daoKey = payload.daoAddress.trim().toLowerCase();

  const subscribers = await prisma.chatSubscription.findMany({
    where: { daoAddress: daoKey, receiveNotifications: true },
    include: { user: true },
  });

  const senderLower = payload.senderWallet.trim().toLowerCase();
  const recipients = subscribers.filter((s) => s.user.walletAddress.toLowerCase() !== senderLower);

  const titleDao = payload.daoName?.trim() || 'Community';
  const msgStr = payload.senderName?.trim() || 'Someone';
  const preview = typeof payload.message === 'string' ? payload.message : '';

  let inApp = 0;
  let emailJobs = 0;

  for (const sub of recipients) {
    const user = sub.user;
    const correlationId = payload.correlationId;

    const data = JSON.stringify({
      daoAddress: daoKey,
      daoName: titleDao,
      message: preview,
      senderWallet: senderLower,
      senderName: msgStr,
      timestamp: payload.timestamp ?? Date.now(),
      correlationId,
    });

    const notif = await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'NEW_CHAT_MESSAGE',
        title: `New message in ${titleDao}`,
        message: `${msgStr}: ${preview.slice(0, 240)}`,
        data,
        emailSent: false,
      },
    });
    inApp++;

    const emailAddr = user.email?.trim();
    if (!emailAddr) continue;

    if (options.mode === 'queue' && channel) {
      await publishEmailDeliverJob(channel, {
        v: 1,
        correlationId,
        notificationId: notif.id,
        recipientEmail: emailAddr,
      });
      emailJobs++;
    } else {
      await deliverNotificationEmail(notif.id, emailAddr);
      emailJobs++;
    }
  }

  return {
    subscriberCount: recipients.length,
    inAppNotifications: inApp,
    emailJobsPublished: emailJobs,
  };
}

async function deliverNotificationEmail(notificationId: string, recipientEmail: string): Promise<void> {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) return;

  let meta: Record<string, unknown> = {};
  if (notification.data) {
    try {
      meta = JSON.parse(notification.data) as Record<string, unknown>;
    } catch {
      meta = {};
    }
  }

  const daoName = typeof meta.daoName === 'string' ? meta.daoName : 'Community';
  const senderName = typeof meta.senderName === 'string' ? meta.senderName : 'Someone';
  const message = typeof meta.message === 'string' ? meta.message : '';

  const html = gmailMailer.buildChatNotificationHtml(daoName, senderName, message);

  await gmailMailer.sendOutboundNotification(
    recipientEmail,
    `💬 New message in ${daoName}`,
    html,
  );

  await prisma.notification.update({
    where: { id: notificationId },
    data: { emailSent: true },
  });
}

/** Single queue job handler for outbound mail. */
export async function processEmailDeliverJob(payload: EmailDeliverPayload): Promise<void> {
  await deliverNotificationEmail(payload.notificationId, payload.recipientEmail);
}

export async function isNotificationAlreadyEmailed(notificationId: string): Promise<boolean> {
  const row = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { emailSent: true },
  });
  return Boolean(row?.emailSent);
}
