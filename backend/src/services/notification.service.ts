import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class NotificationService {
  async notifyNewDAO(data: any) {
    console.log(`🏛️ New DAO Created: ${data.name} in ${data.location}`);
    // Email logic will be added here
  }
  
  async notifyNewInvestment(data: any) {
    console.log(`💰 New Investment: ${data.name} needs ${data.fundNeeded} USDC`);
    
    // Create notification in database
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: 'system',
          type: 'NEW_INVESTMENT',
          title: `New Investment: ${data.name}`,
          message: `${data.daoName} needs ${data.fundNeeded} USDC`,
          data: JSON.stringify(data),
          emailSent: false
        }
      });
      console.log(`📝 Notification created: ${notification.id}`);
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }
  
  async notifyYieldDeposited(data: any) {
    console.log(`💵 Yield Deposited: ${data.amount} USDC for investment #${data.investmentId}`);
    
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: 'system',
          type: 'YIELD_CLAIMABLE',
          title: `💰 Yield Available!`,
          message: `${data.amount} USDC yield deposited`,
          data: JSON.stringify(data),
          emailSent: false
        }
      });
      console.log(`📝 Yield notification created: ${notification.id}`);
    } catch (error) {
      console.error('Error creating yield notification:', error);
    }
  }
  
  async notifyVoteCast(data: any) {
    const voteType = data.voteValue === 1 ? 'UPVOTE' : 'DOWNVOTE';
    console.log(`🗳️ ${voteType}: ${data.numberOfVotes} votes on investment #${data.investmentId}`);
  }
  
  async notifyInvestmentActivated(data: any) {
    console.log(`✅ Investment #${data.investmentId} has been ACTIVATED in ${data.daoName}`);
  }
}
