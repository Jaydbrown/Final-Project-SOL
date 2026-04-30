import { defineChain, type Address } from "viem";

const DEFAULT_CHAIN_ID = 4202;
const DEFAULT_CHAIN_NAME = "Lisk Sepolia";
const DEFAULT_RPC_URL = "https://rpc.sepolia-api.lisk.com";
const DEFAULT_EXPLORER_URL = "https://sepolia-blockscout.lisk.com";
const DEFAULT_FACTORY_ADDRESS = "0xBD8ad41bB16acEc5Da477Ff79c7770ad3c0b1Fa2";
const DEFAULT_USDC_ADDRESS = "0x0000000000000000000000000000000000000000";

function parseChainId(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const APP_CHAIN_ID = parseChainId(import.meta.env.VITE_CHAIN_ID as string | undefined, DEFAULT_CHAIN_ID);
export const APP_CHAIN_NAME = (import.meta.env.VITE_CHAIN_NAME as string | undefined)?.trim() || DEFAULT_CHAIN_NAME;
export const APP_RPC_URL = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim() || DEFAULT_RPC_URL;
export const APP_EXPLORER_URL =
  (import.meta.env.VITE_EXPLORER_URL as string | undefined)?.trim() || DEFAULT_EXPLORER_URL;

export const FACTORY_ADDRESS = ((import.meta.env.VITE_FACTORY_ADDRESS as string | undefined)?.trim() ||
  DEFAULT_FACTORY_ADDRESS) as Address;
export const USDC_ADDRESS = ((import.meta.env.VITE_USDC_ADDRESS as string | undefined)?.trim() ||
  DEFAULT_USDC_ADDRESS) as Address;

export const APP_CHAIN = defineChain({
  id: APP_CHAIN_ID,
  name: APP_CHAIN_NAME,
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [APP_RPC_URL],
    },
    public: {
      http: [APP_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: APP_EXPLORER_URL,
    },
  },
  testnet: true,
});

// LocalDAOFactory ABI from current deployed contract interface (used app-wide).
export const FACTORY_ABI = [
  {
    type: "function",
    name: "createDAO",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "location", type: "string" },
      { name: "coordinates", type: "string" },
      { name: "postalCode", type: "string" },
      { name: "maxMembership", type: "uint256" },
      { name: "usdcAddress", type: "address" },
    ],
    outputs: [{ name: "daoAddress", type: "address" }],
  },
  {
    type: "function",
    name: "getActiveDAOs",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "daoInfo",
    stateMutability: "view",
    inputs: [{ name: "daoAddress", type: "address" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "location", type: "string" },
      { name: "creator", type: "address" },
      { name: "createdAt", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "DAOCreated",
    inputs: [
      { indexed: true, name: "daoAddress", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "location", type: "string" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;
