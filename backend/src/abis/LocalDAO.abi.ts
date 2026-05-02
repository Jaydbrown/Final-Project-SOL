export const LOCAL_DAO_ABI = [
  {
    type: 'event',
    name: 'InvestmentCreated',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'fundNeeded', type: 'uint256', indexed: false },
      { name: 'grade', type: 'uint8', indexed: false },
      { name: 'deadline', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'YieldDeposited',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expenseReportCID', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'voter', type: 'address', indexed: true },
      { name: 'numberOfVotes', type: 'uint256', indexed: false },
      { name: 'voteValue', type: 'uint8', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'InvestmentActivated',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'InvestmentClosed',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'YieldClaimed',
    inputs: [
      { name: 'investmentId', type: 'uint256', indexed: true },
      { name: 'claimer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  }
] as const;
