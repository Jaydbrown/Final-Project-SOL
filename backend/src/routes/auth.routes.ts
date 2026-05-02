import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { normalizeWalletAddress } from '../utils/wallet';

const router = Router();
const prisma = new PrismaClient();

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

// Generate Gmail auth URL
router.post('/gmail/connect', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.body?.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    console.log('📧 Gmail connect request for:', walletAddress);

    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      state: user.id,
      prompt: 'consent'
    });
    
    res.json({ url: authUrl });
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback
router.get('/gmail/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('📞 OAuth callback received');

    const { tokens } = await oauth2Client.getToken(code as string);

    // Get user email from token
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();

    const email = userInfo.data.email?.trim() || undefined;
    const existing = await prisma.user.findUnique({ where: { id: state as string } });

    await prisma.user.update({
      where: { id: state as string },
      data: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token ?? existing?.gmailRefreshToken ?? undefined,
        ...(email ? { email } : {}),
      },
    });
    
    console.log('✅ Gmail connected successfully for:', userInfo.data.email);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?gmail=connected`);
  } catch (error: any) {
    console.error('❌ OAuth error:', error.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?gmail=error`);
  }
});

// Check Gmail connection status
router.get('/preferences/:walletAddress', async (req, res) => {
  try {
    const walletAddress = normalizeWalletAddress(req.params.walletAddress);
    if (!walletAddress) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress },
    });
    
    res.json({ 
      gmailConnected: !!user?.gmailRefreshToken,
      email: user?.email,
      walletAddress
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
