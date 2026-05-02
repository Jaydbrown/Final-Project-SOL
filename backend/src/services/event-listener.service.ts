import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { LOCAL_DAO_ABI } from '../abis/LocalDAO.abi';
import { DAO_FACTORY_ABI } from '../abis/DAOFactory.abi';
import { NotificationService } from './notification.service';

export class EventListenerService {
  private publicClient;
  private notificationService: NotificationService;
  
  constructor(notificationService: NotificationService) {
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(process.env.RPC_URL || 'https://ethereum-sepolia.publicnode.com')
    });
    this.notificationService = notificationService;
  }
  
  async watchDAOFactoryEvents(factoryAddress: `0x${string}`) {
    console.log(`Watching DAO Factory at ${factoryAddress}`);
    
    this.publicClient.watchContractEvent({
      address: factoryAddress,
      abi: DAO_FACTORY_ABI,
      eventName: 'DAOCreated',
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          await this.notificationService.notifyNewDAO({
            daoAddress: args.daoAddress,
            name: args.name,
            location: args.location,
            creator: args.creator,
            timestamp: args.timestamp
          });
        }
      }
    });
  }
  
  async watchDAOEvents(daoAddress: `0x${string}`, daoName: string) {
    console.log(`Watching DAO ${daoName} at ${daoAddress}`);
    
    this.publicClient.watchContractEvent({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      eventName: 'InvestmentCreated',
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          await this.notificationService.notifyNewInvestment({
            daoAddress,
            daoName,
            investmentId: args.investmentId,
            name: args.name,
            fundNeeded: args.fundNeeded,
            grade: args.grade,
            deadline: args.deadline
          });
        }
      }
    });
    
    this.publicClient.watchContractEvent({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      eventName: 'YieldDeposited',
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          await this.notificationService.notifyYieldDeposited({
            daoAddress,
            daoName,
            investmentId: args.investmentId,
            amount: args.amount,
            expenseReportCID: args.expenseReportCID,
            timestamp: args.timestamp
          });
        }
      }
    });
    
    this.publicClient.watchContractEvent({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      eventName: 'VoteCast',
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          await this.notificationService.notifyVoteCast({
            daoAddress,
            daoName,
            investmentId: args.investmentId,
            voter: args.voter,
            numberOfVotes: args.numberOfVotes,
            voteValue: args.voteValue
          });
        }
      }
    });
    
    this.publicClient.watchContractEvent({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      eventName: 'InvestmentActivated',
      onLogs: async (logs) => {
        for (const log of logs) {
          const args = log.args as any;
          await this.notificationService.notifyInvestmentActivated({
            daoAddress,
            daoName,
            investmentId: args.investmentId
          });
        }
      }
    });
  }
}
