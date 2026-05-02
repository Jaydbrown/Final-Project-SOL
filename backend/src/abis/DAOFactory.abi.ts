export const DAO_FACTORY_ABI = [
  {
    type: 'event',
    name: 'DAOCreated',
    inputs: [
      { name: 'daoAddress', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'location', type: 'string', indexed: false },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'function',
    name: 'getAllDAOs',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getActiveDAOs',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view'
  }
] as const;
