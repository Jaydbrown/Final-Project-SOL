import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const router = Router();
const prisma = new PrismaClient();

// Subscribe to chat notifications
router.post('/subscribe', async (req, res) => {
  try {
    const { walletAddress, daoAddress, receiveNotifications, email } = req.body;
    
    console.log('📝 Subscribe request:', { walletAddress, daoAddress, receiveNotifications });
    
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
    
    console.log('✅ Subscription created:', subscription);
    res.json({ success: true, subscription });
  } catch (error: any) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's subscriptions
router.get('/subscriptions/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        chatSubscriptions: true
      }
    });
    
    res.json(user?.chatSubscriptions || []);
  } catch (error: any) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook for new chat messages
router.post('/webhook/new-message', async (req, res) => {
  try {
    const { daoAddress, daoName, message, senderWallet, senderName, timestamp } = req.body;
    
    console.log(`📨 New message in ${daoName} from ${senderName}`);
    console.log(`Message: ${message}`);
    
    const subscribers = await prisma.chatSubscription.findMany({
      where: {
        daoAddress: daoAddress.toLowerCase(),
        receiveNotifications: true
      },
      include: {
        user: true
      }
    });
    
    const recipients = subscribers.filter(
      sub => sub.user.walletAddress.toLowerCase() !== senderWallet.toLowerCase()
    );
    
    console.log(`📧 Found ${recipients.length} subscribers to notify`);
    
    let emailCount = 0;
    for (const recipient of recipients) {
      const user = recipient.user;
      
      if (user.email) {
        try {
          // Use App Password method (simpler, no TypeScript errors)
          await sendEmailWithAppPassword(user.email, daoName, senderName, message);
          emailCount++;
          console.log(`✅ Email sent to ${user.email}`);
        } catch (error: any) {
          console.error(`Failed to send email to ${user.email}:`, error.message);
        }
      }
    }
    
    res.json({ success: true, notified: emailCount });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email using App Password (works with nodemailer types)
async function sendEmailWithAppPassword(
  toEmail: string,
  daoName: string,
  senderName: string,
  message: string
) {
  // Create transporter with gmail service (no TypeScript errors)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
      <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0;">💬 New Chat Message</h2>
      </div>
      <div style="background: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="font-size: 14px; color: #666;">in <strong>${daoName}</strong></p>
        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p style="font-weight: bold; margin: 0 0 8px 0;">${senderName} wrote:</p>
          <p style="margin: 0; color: #1e293b;">${message}</p>
        </div>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/messages" 
           style="display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin-top: 10px;">
          Reply in Chat →
        </a>
      </div>
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
        <p>You're receiving this because you subscribed to notifications for this DAO.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings" style="color: #059669;">Manage notifications</a>
      </div>
    </div>
  `;
  
  const result = await transporter.sendMail({
    from: `"LocalDAO" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `💬 New message in ${daoName}`,
    html
  });
  
  console.log('📧 Email sent, messageId:', result.messageId);
  return result;
}

export default router;
