import { google } from 'googleapis';
import nodemailer from 'nodemailer';

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class GmailService {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI,
    );
  }

  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
      state: userId,
      prompt: 'consent',
    });
  }

  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Self-test / utility: send using the end-user’s Gmail OAuth (same address to same address).
   */
  async sendEmail(userEmail: string, refreshToken: string, subject: string, html: string) {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const accessToken = await this.oauth2Client.getAccessToken();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: userEmail,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken,
        accessToken: accessToken.token || '',
      },
    });

    const info = await transporter.sendMail({
      from: `LocalDAO Chat <${userEmail}>`,
      to: userEmail,
      subject,
      html,
    });

    return info;
  }

  buildChatNotificationHtml(daoName: string, senderName: string, messageContent: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const safeDao = escapeHtml(daoName);
    const safeSender = escapeHtml(senderName);
    const safeMsg = escapeHtml(messageContent);

    return `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <div style="background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0;">💬 New Chat Message</h2>
        </div>
        <div style="background: #ffffff; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="font-size: 14px; color: #666;">in <strong>${safeDao}</strong></p>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="font-weight: bold; margin: 0 0 8px 0;">${safeSender} wrote:</p>
            <p style="margin: 0; color: #1e293b; white-space: pre-wrap;">${safeMsg}</p>
          </div>
          <a href="${base}/messages"
             style="display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin-top: 10px;">
            Reply in Chat →
          </a>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
          <p>You're receiving this because you subscribed to notifications for this DAO.</p>
          <a href="${base}/dashboard" style="color: #059669;">Manage notifications</a>
        </div>
      </div>
    `;
  }

  /**
   * Production path: send FROM the LocalDAO notification mailbox (OAuth refresh token or app password).
   */
  async sendOutboundNotification(toEmail: string, subject: string, htmlBody: string) {
    const fromEmail =
      process.env.GMAIL_FROM_EMAIL?.trim() || process.env.GMAIL_USER?.trim();
    const appPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    const mailerRefresh = process.env.GMAIL_MAILER_REFRESH_TOKEN?.trim();
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();

    if (!fromEmail) {
      throw new Error('Set GMAIL_FROM_EMAIL (or GMAIL_USER) for outbound mail.');
    }

    if (mailerRefresh && clientId && clientSecret) {
      this.oauth2Client.setCredentials({ refresh_token: mailerRefresh });
      const accessTokenResult = await this.oauth2Client.getAccessToken();
      const accessToken = accessTokenResult.token ?? '';
      if (!accessToken) {
        throw new Error('Failed to obtain access token for mailer OAuth. Check GMAIL_MAILER_REFRESH_TOKEN.');
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: fromEmail,
          clientId,
          clientSecret,
          refreshToken: mailerRefresh,
          accessToken,
        },
      });

      return transporter.sendMail({
        from: `"LocalDAO" <${fromEmail}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
    }

    if (appPassword) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: fromEmail,
          pass: appPassword,
        },
      });

      return transporter.sendMail({
        from: `"LocalDAO" <${fromEmail}>`,
        to: toEmail,
        subject,
        html: htmlBody,
      });
    }

    throw new Error(
      'Outbound mail not configured: set GMAIL_MAILER_REFRESH_TOKEN with GMAIL_FROM_EMAIL ' +
        'or use GMAIL_APP_PASSWORD (with GMAIL_USER / GMAIL_FROM_EMAIL).',
    );
  }

  async sendChatNotification(
    userEmail: string,
    refreshToken: string,
    daoName: string,
    senderName: string,
    messageContent: string,
  ) {
    const subject = `💬 New message in ${daoName}`;
    const html = this.buildChatNotificationHtml(daoName, senderName, messageContent);
    return this.sendEmail(userEmail, refreshToken, subject, html);
  }
}
