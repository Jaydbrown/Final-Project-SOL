// Chain ID to name mapping
const CHAIN_NAMES: Record<string, string> = {
  'eip155:1': 'Ethereum Mainnet',
  'eip155:5': 'Goerli Testnet',
  'eip155:11155111': 'Sepolia Testnet',
  'eip155:42161': 'Arbitrum One',
  'eip155:421613': 'Arbitrum Goerli',
  'eip155:421614': 'Arbitrum Sepolia',
  'eip155:10': 'Optimism',
  'eip155:420': 'Optimism Goerli',
  'eip155:137': 'Polygon',
  'eip155:80001': 'Polygon Mumbai',
  'eip155:8453': 'Base',
  'eip155:84531': 'Base Goerli',
  'eip155:84532': 'Base Sepolia',
  'eip155:56': 'BNB Chain',
  'eip155:43114': 'Avalanche C-Chain',
  'eip155:43113': 'Avalanche Fuji',
  'eip155:4202': 'Lisk Sepolia',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana Mainnet',
  'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': 'Solana Devnet',
};

export function getChainName(chainId: string | undefined | null): string {
  if (!chainId) return 'Not Connected';
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

export function getChainShortName(chainId: string | undefined | null): string {
  const name = getChainName(chainId);
  // Return shorter versions for UI
  return name
    .replace(' Mainnet', '')
    .replace(' One', '')
    .replace(' C-Chain', '');
}
