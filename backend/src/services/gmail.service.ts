import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class GmailService {
  private oauth2Client;
  
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
  }
  
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ],
      state: userId,
      prompt: 'consent'
    });
  }
  
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }
  
  async sendEmail(userEmail: string, refreshToken: string, subject: string, html: string) {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
      const accessToken = await this.oauth2Client.getAccessToken();
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: userEmail,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: refreshToken,
          accessToken: accessToken.token || ''
        }
      });
      
      const info = await transporter.sendMail({
        from: `LocalDAO Chat <${userEmail}>`,
        to: userEmail,
        subject: subject,
        html: html
      });
      
      console.log('✅ Email sent:', info.messageId);
      return info;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }
  
  async sendChatNotification(
    userEmail: string, 
    refreshToken: string, 
    daoName: string, 
    senderName: string, 
    messageContent: string
  ) {
    const subject = `💬 New message in ${daoName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .message-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .sender { font-weight: 600; color: #059669; margin-bottom: 8px; }
          .message { color: #334155; margin: 10px 0; }
          .timestamp { font-size: 12px; color: #94a3b8; margin-top: 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #059669; color: white; text-decoration: none; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>💬 New Chat Message</h2>
            <p style="margin: 0; opacity: 0.9;">${daoName}</p>
          </div>
          <div class="content">
            <div class="message-box">
              <div class="sender">${senderName} wrote:</div>
              <div class="message">${messageContent}</div>
              <div class="timestamp">${new Date().toLocaleString()}</div>
            </div>
            <a href="${process.env.FRONTEND_URL}/messages" class="button">Reply in Chat →</a>
          </div>
          <div class="footer">
            <p>You're receiving this because you subscribed to chat notifications for this DAO.</p>
            <p><a href="${process.env.FRONTEND_URL}/settings/notifications" style="color: #059669;">Manage notifications</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    return this.sendEmail(userEmail, refreshToken, subject, html);
  }
}
