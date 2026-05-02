import { randomUUID } from 'crypto';

import { Router } from 'express';

import { prisma } from '../db/prisma';
import { rabbitUrlConfigured } from '../messaging/connection';
import { enqueueChatWebhookJob } from '../messaging/publish/chatMessage.publisher';
import type { ChatMessageReceivedPayload } from '../messaging/types';
import {
  processChatMessageDispatch,
} from '../services/chat-notification.processor';

import { normalizeWalletAddress } from '../utils/wallet';

const router = Router();

router.post('/subscribe', async (req, res) => {
  try {
    const { walletAddress: rawWallet, daoAddress: rawDao, receiveNotifications, email } = req.body;
    const walletAddress = normalizeWalletAddress(rawWallet);
    const daoNorm = typeof rawDao === 'string' ? rawDao.trim().toLowerCase() : '';

    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    if (!daoNorm || !daoNorm.startsWith('0x')) {
      return res.status(400).json({ error: 'Invalid DAO address' });
    }

    console.log('📝 Subscribe request:', { walletAddress, daoAddress: daoNorm, receiveNotifications });

    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress, email: typeof email === 'string' && email.trim() ? email.trim() : undefined },
      });
    } else if (email && typeof email === 'string' && email.trim() && !user.email) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email: email.trim() },
      });
    }

    const subscription = await prisma.chatSubscription.upsert({
      where: {
        userId_daoAddress: {
          userId: user.id,
          daoAddress: daoNorm,
        },
      },
      update: { receiveNotifications: Boolean(receiveNotifications) },
      create: {
        userId: user.id,
        daoAddress: daoNorm,
        receiveNotifications: Boolean(receiveNotifications),
      },
    });

    console.log('✅ Subscription created:', subscription.id);
    res.json({ success: true, subscription });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Subscribe error:', message);
    res.status(500).json({ error: message });
  }
});

router.get('/subscriptions/:walletAddress', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.params.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        chatSubscriptions: true,
      },
    });

    res.json(user?.chatSubscriptions || []);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get subscriptions error:', message);
    res.status(500).json({ error: message });
  }
});

/** Webhook publishes to RabbitMQ (preferred) — workers handle DB writes + SMTP jobs. Falls back synchronous if broker absent or publish fails. */
router.post('/webhook/new-message', async (req, res) => {
  try {
    const { daoAddress, daoName, message, senderWallet, senderName, timestamp } = req.body;
    const daoKey = typeof daoAddress === 'string' ? daoAddress.trim().toLowerCase() : '';

    if (!daoKey) {
      return res.status(400).json({ error: 'daoAddress is required' });
    }

    const preview = typeof message === 'string' ? message : '';
    const msgStr = typeof senderName === 'string' ? senderName : 'Someone';
    const titleDao = typeof daoName === 'string' ? daoName : 'Community';
    const ts = typeof timestamp === 'number' ? timestamp : Date.now();
    const sender = typeof senderWallet === 'string' ? senderWallet : '';

    console.log(`📨 Webhook: ${titleDao} from ${msgStr}`);

    if (rabbitUrlConfigured()) {
      try {
        const { correlationId } = await enqueueChatWebhookJob({
          daoAddress: daoKey,
          daoName: titleDao,
          message: preview,
          senderWallet: sender,
          senderName: msgStr,
          timestamp: ts,
        });

        const excludingSender = normalizeWalletAddress(sender);
        const estimatedRecipients = await prisma.chatSubscription.count({
          where: {
            daoAddress: daoKey,
            receiveNotifications: true,
            ...(excludingSender
              ? { user: { walletAddress: { not: excludingSender } } }
              : {}),
          },
        });

        return res.status(202).json({
          success: true,
          queued: true,
          correlationId,
          estimatedRecipients: Math.max(0, estimatedRecipients),
        });
      } catch (queueErr: unknown) {
        const warn = queueErr instanceof Error ? queueErr.message : String(queueErr);
        console.warn('[webhook] RabbitMQ publish failed — running synchronous pipeline:', warn);
      }
    }

    const correlationId = `sync:${randomUUID()}`;
    const payload: ChatMessageReceivedPayload = {
      v: 1,
      correlationId,
      daoAddress: daoKey,
      daoName: titleDao,
      message: preview,
      senderWallet: sender,
      senderName: msgStr,
      timestamp: ts,
    };

    const outcome = await processChatMessageDispatch(payload, null, { mode: 'sync' });

    return res.json({
      success: true,
      queued: false,
      correlationId,
      notified: outcome.emailJobsPublished,
      inAppNotifications: outcome.inAppNotifications,
      subscribers: outcome.subscriberCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
