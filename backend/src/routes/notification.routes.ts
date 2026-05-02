import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { GmailService } from '../services/gmail.service';

const router = Router();
const prisma = new PrismaClient();
const gmailService = new GmailService();

// Subscribe user to chat notifications
router.post('/chat/subscribe', async (req, res) => {
  try {
    const { walletAddress, email, daoAddress, receiveNotifications } = req.body;
    
    let user = await prisma.user.findUnique({
      where: { walletAddress }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress, email }
      });
    } else if (email && !user.email) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email }
      });
    }
    
    // Store DAO subscription
    const subscription = await prisma.chatSubscription.upsert({
      where: {
        userId_daoAddress: {
          userId: user.id,
          daoAddress: daoAddress.toLowerCase()
        }
      },
      update: { receiveNotifications },
      create: {
        userId: user.id,
        daoAddress: daoAddress.toLowerCase(),
        receiveNotifications
      }
    });
    
    res.json({ success: true, subscription });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's chat subscriptions
router.get('/chat/subscriptions/:walletAddress', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { walletAddress: req.params.walletAddress },
      include: {
        chatSubscriptions: true
      }
    });
    
    res.json(user?.chatSubscriptions || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test notification endpoint
router.post('/chat/test', async (req, res) => {
  try {
    const { walletAddress, daoName, messageContent, senderName } = req.body;
    
    const user = await prisma.user.findUnique({
      where: { walletAddress }
    });
    
    if (!user || !user.email || !user.gmailRefreshToken) {
      return res.status(400).json({ 
        error: 'User has not connected Gmail or provided email' 
      });
    }
    
    await gmailService.sendChatNotification(
      user.email,
      user.gmailRefreshToken,
      daoName,
      senderName,
      messageContent
    );
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
