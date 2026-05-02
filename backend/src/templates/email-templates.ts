// src/templates/email-templates.ts
export class EmailTemplate {
  static getTemplate(type: string, data: any): string {
    const templates = {
      NEW_INVESTMENT: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>🚀 New Investment Opportunity</h2>
          <p><strong>${data.name}</strong> needs <strong>${data.fundNeeded} USDC</strong></p>
          <p>Grade: ${data.grade}</p>
          <p>DAO: ${data.daoName}</p>
          <a href="${process.env.FRONTEND_URL}/invest/${data.investmentId}" 
             style="background: #2196F3; color: white; padding: 10px 20px; text-decoration: none;">
            View Investment
          </a>
        </div>
      `,
      
      YIELD_CLAIMABLE: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2>💰 Yield Available to Claim!</h2>
          <p><strong>${data.amount} USDC</strong> has been deposited as yield.</p>
          <p>Investment: #${data.investmentId}</p>
          <p>DAO: ${data.daoName}</p>
          <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Expense Report:</strong></p>
            <p style="margin: 0;"><a href="${data.expenseReportCID}">View on IPFS</a></p>
          </div>
          <a href="${process.env.FRONTEND_URL}/claim/${data.investmentId}" 
             style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none;">
            Claim Your Yield
          </a>
        </div>
      `,
      
      VOTE_CAST: `
        <div style="font-family: Arial, sans-serif;">
          <h2>🗳️ New Vote on Your Investment</h2>
          <p><strong>${data.numberOfVotes} votes</strong> ${data.voteValue === 1 ? 'UPVOTED' : 'DOWNVOTED'} investment #${data.investmentId}</p>
          <p>DAO: ${data.daoName}</p>
          <a href="${process.env.FRONTEND_URL}/investments/${data.investmentId}">View Details</a>
        </div>
      `
    };
    
    return templates[type] || `<p>${data.message}</p>`;
  }
  
  static getDailyDigest(notifications: any[]): string {
    return `
      <div style="font-family: Arial, sans-serif;">
        <h2>📊 Your Daily LocalDAO Digest</h2>
        ${notifications.map(n => `
          <div style="border-left: 3px solid #4CAF50; margin: 10px 0; padding: 10px;">
            <strong>${n.title}</strong><br/>
            ${n.message}
          </div>
        `).join('')}
        <a href="${process.env.FRONTEND_URL}/dashboard">View All →</a>
      </div>
    `;
  }
}