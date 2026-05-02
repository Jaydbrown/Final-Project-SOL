import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { closePublishConnectionGracefully, rabbitHealthCheck } from './messaging/connection';
import { normalizeWalletAddress } from './utils/wallet';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Import routes
import authRoutes from './routes/auth.routes';
import chatRoutes from './routes/chat.routes';
import aiRoutes from './routes/ai.routes';

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

// Test endpoint to create a user
app.post('/api/users', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by wallet address
app.get('/api/users/:walletAddress', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.params.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { 
        preferences: true, 
        notifications: true 
      }
    });
    res.json(user || { error: 'User not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's chat subscriptions separately
app.get('/api/users/:walletAddress/subscriptions', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.params.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: { chatSubscriptions: true }
    });
    res.json(user?.chatSubscriptions || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', async (_req, res) => {
  const gmailOAuth = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET);
  const fromEmail = !!(process.env.GMAIL_FROM_EMAIL?.trim() || process.env.GMAIL_USER?.trim());
  const oauthMailer = !!process.env.GMAIL_MAILER_REFRESH_TOKEN?.trim();
  const appPassword = !!process.env.GMAIL_APP_PASSWORD?.trim();
  const rabbit = await rabbitHealthCheck();
  const geminiConfigured = !!process.env.GEMINI_API_KEY?.trim();
  res.json({
    status: 'ok',
    gmailConfigured: gmailOAuth,
    outboundMailConfigured: fromEmail && (oauthMailer || appPassword),
    rabbitmq: rabbit,
    geminiConfigured,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'LocalDAO Backend Running!',
    endpoints: {
      'POST /api/auth/gmail/connect': 'Connect Gmail account',
      'GET /api/auth/gmail/callback': 'OAuth callback',
      'POST /api/chat/webhook/new-message': 'Enqueue chat notify job (HTTP 202) — requires workers',
      'POST /api/chat/subscribe': 'Subscribe to chat notifications',
      'GET /api/chat/subscriptions/:walletAddress': 'Get chat subscriptions',
      'POST /api/ai/chat': 'Homepage Gemini assistant (body: { messages })',
      'POST /api/users': 'Create user',
      'GET /api/users/:walletAddress': 'Get user'
    }
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📧 Gmail OAuth client: ${process.env.GMAIL_CLIENT_ID ? 'Configured' : 'Not configured'}`);
  const hasFrom = !!(process.env.GMAIL_FROM_EMAIL?.trim() || process.env.GMAIL_USER?.trim());
  const hasOutbound = !!(
    process.env.GMAIL_MAILER_REFRESH_TOKEN?.trim() || process.env.GMAIL_APP_PASSWORD?.trim()
  );
  if (hasFrom && hasOutbound) {
    console.log('📧 Chat outbound SMTP: Ready (OAuth mailer token or app password)');
  } else {
    console.warn(
      '📧 Chat outbound mail not fully configured — set GMAIL_FROM_EMAIL (+ GMAIL_MAILER_REFRESH_TOKEN or GMAIL_APP_PASSWORD). ' +
        'User "Connect Gmail" still saves subscriber email.',
    );
  }
  if (process.env.RABBITMQ_URL?.trim()) {
    console.log('🐇 RabbitMQ: RABBITMQ_URL set — run `npm run worker` in backend for consumers.');
  } else {
    console.warn('🐇 RabbitMQ: disabled — webhook will process notifications synchronously.');
  }
  if (process.env.GEMINI_API_KEY?.trim()) {
    console.log(`🤖 Gemini: HOMEPAGE AI enabled (model ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}).`);
  } else {
    console.warn('🤖 Gemini: GEMINI_API_KEY not set — POST /api/ai/chat returns 503.');
  }
});

const shutdownApi = async (signal: string) => {
  console.warn(`${signal}: closing Rabbit publish channel…`);
  await closePublishConnectionGracefully();
  process.exit(0);
};
process.once('SIGINT', () => void shutdownApi('SIGINT'));
process.once('SIGTERM', () => void shutdownApi('SIGTERM'));

// Update user email
app.post('/api/update-email', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    console.log('📧 Updating email for wallet:', walletAddress, 'to:', email);

    // First, remove email from any other user
    await prisma.user.updateMany({
      where: {
        email,
        NOT: { walletAddress },
      },
      data: { email: null },
    });

    // Update or create user with email
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: { email },
      create: { walletAddress, email },
    });
    
    console.log('✅ Email updated:', user);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('❌ Error updating email:', error);
    res.status(500).json({ error: error.message });
  }
});
