import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeEventLog,
  fallback,
  formatUnits,
  http,
  keccak256,
  parseUnits,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {
  APP_CHAIN,
  APP_CHAIN_ID,
  APP_RPC_URL,
  FACTORY_ABI,
  FACTORY_ADDRESS,
  USDC_ADDRESS,
} from "./contract";

const RPC_ENDPOINTS = [
  import.meta.env.VITE_RPC_URL,
  APP_RPC_URL,
].filter((value): value is string => Boolean(value));

const LOCAL_DAO_ABI = [
  { type: "error", name: "InvalidInvestment", inputs: [] },
  { type: "error", name: "NotPending", inputs: [] },
  { type: "error", name: "DeadlinePassed", inputs: [] },
  { type: "error", name: "InvalidVoteValue", inputs: [] },
  { type: "error", name: "UpvoteRequiresStake", inputs: [] },
  { type: "error", name: "InsufficientBalance", inputs: [] },
  { type: "error", name: "InsufficientAllowance", inputs: [] },
  { type: "error", name: "CannotChangeDownToUp", inputs: [] },
  { type: "error", name: "AlreadyVoted", inputs: [] },
  { type: "error", name: "DownvoteNoStake", inputs: [] },
  {
    type: "function",
    name: "creator",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "isAdmin",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isFinanceManager",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "isVerifiedMember",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "description",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "memberCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalValueLocked",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "investmentCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getInvestment",
    stateMutability: "view",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "status", type: "uint8" },
          { name: "category", type: "uint8" },
          { name: "deadline", type: "uint256" },
          { name: "upvotes", type: "uint256" },
          { name: "downvotes", type: "uint256" },
          { name: "fundNeeded", type: "uint256" },
          { name: "expectedYield", type: "uint256" },
          { name: "grade", type: "uint8" },
          { name: "documentCIDs", type: "string[]" },
          { name: "totalYieldGenerated", type: "uint256" },
          { name: "totalYieldDistributed", type: "uint256" },
          { name: "extensionCount", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "createdBy", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getVoteCounts",
    stateMutability: "view",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "getVote",
    stateMutability: "view",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "voter", type: "address" },
          { name: "investmentId", type: "uint256" },
          { name: "numberOfVotes", type: "uint256" },
          { name: "voteValue", type: "uint8" },
          { name: "timestamp", type: "uint256" },
          { name: "hasClaimedYield", type: "bool" },
          { name: "yieldClaimed", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getAllMembers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    type: "function",
    name: "createInvestment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "category", type: "uint8" },
      { name: "fundNeeded", type: "uint256" },
      { name: "expectedYield", type: "uint256" },
      { name: "grade", type: "uint8" },
      { name: "deadline", type: "uint256" },
      { name: "documentCIDs", type: "string[]" },
    ],
    outputs: [{ name: "investmentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "calculateClaimableYield",
    stateMutability: "view",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getYieldDistribution",
    stateMutability: "view",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "investmentId", type: "uint256" },
          { name: "totalAmount", type: "uint256" },
          { name: "distributedAmount", type: "uint256" },
          { name: "remainingAmount", type: "uint256" },
          { name: "expenseReportCID", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "addMember",
    stateMutability: "nonpayable",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "kycProofHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "verifyMemberKYC",
    stateMutability: "nonpayable",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "removeMember",
    stateMutability: "nonpayable",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addAdmin",
    stateMutability: "nonpayable",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "removeAdmin",
    stateMutability: "nonpayable",
    inputs: [{ name: "admin", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addFinanceManager",
    stateMutability: "nonpayable",
    inputs: [{ name: "manager", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "removeFinanceManager",
    stateMutability: "nonpayable",
    inputs: [{ name: "manager", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "updateDAOInfo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "newDescription", type: "string" },
      { name: "newLogoURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "vote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "numberOfVotes", type: "uint256" },
      { name: "voteValue", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "activateInvestment",
    stateMutability: "nonpayable",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "markInvestmentIncomplete",
    stateMutability: "nonpayable",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "closeInvestment",
    stateMutability: "nonpayable",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "sweepUnclaimedYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "pause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unpause",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claimYield",
    stateMutability: "nonpayable",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "depositYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "yieldAmount", type: "uint256" },
      { name: "expenseReportCID", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "extendDeadline",
    stateMutability: "nonpayable",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "additionalDays", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawStake",
    stateMutability: "nonpayable",
    inputs: [{ name: "investmentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getWithdrawableAmount",
    stateMutability: "view",
    inputs: [
      { name: "investmentId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "AdminAdded",
    anonymous: false,
    inputs: [{ indexed: true, name: "admin", type: "address" }],
  },
  {
    type: "event",
    name: "AdminRemoved",
    anonymous: false,
    inputs: [{ indexed: true, name: "admin", type: "address" }],
  },
  {
    type: "event",
    name: "FinanceManagerAdded",
    anonymous: false,
    inputs: [{ indexed: true, name: "manager", type: "address" }],
  },
  {
    type: "event",
    name: "FinanceManagerRemoved",
    anonymous: false,
    inputs: [{ indexed: true, name: "manager", type: "address" }],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: APP_CHAIN,
  transport: fallback(RPC_ENDPOINTS.map((url) => http(url))),
});

async function getLogsWithRpcFallback(params: Parameters<typeof publicClient.getLogs>[0]) {
  let lastError: unknown = null;
  for (const url of RPC_ENDPOINTS) {
    const rpcClient = createPublicClient({
      chain: APP_CHAIN,
      transport: http(url),
    });
    try {
      return await rpcClient.getLogs(params);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Failed to fetch logs from all configured RPC endpoints.");
}

export type PrivyEthereumWallet = {
  address: string;
  switchChain: (targetChainId: `0x${string}` | number) => Promise<void>;
  getEthereumProvider: () => Promise<unknown>;
};

export type CreateDaoInput = {
  name: string;
  description: string;
  location: string;
  coordinates: string;
  postalCode: string;
  maxMembership: bigint;
};

export type CreateDaoResult = {
  txHash: Hex;
  daoAddress: Address | null;
};

export type OnchainDao = {
  address: Address;
  name: string;
  description: string;
  location: string;
  creator: Address;
  createdAt: bigint;
  isActive: boolean;
  memberCount: number;
  tvlRaw: bigint;
  tvlFormatted: string;
};

export type InvestmentStatus = 0 | 1 | 2 | 3;

export type OnchainInvestment = {
  daoAddress: Address;
  daoName: string;
  id: number;
  name: string;
  status: InvestmentStatus;
  category: number;
  deadline: bigint;
  upvotes: bigint;
  downvotes: bigint;
  fundNeeded: bigint;
  expectedYield: bigint;
  grade: number;
  totalYieldGenerated: bigint;
  totalYieldDistributed: bigint;
  createdAt: bigint;
};

export type InvestmentCreateInput = {
  daoAddress: Address;
  name: string;
  category: number;
  fundNeededUsdc: string;
  expectedYieldPct: number;
  grade: number;
  deadlineDays: number;
  documentCids?: string[];
};

export type YieldRow = {
  daoAddress: Address;
  daoName: string;
  investmentId: number;
  investmentName: string;
  totalYield: bigint;
  distributed: bigint;
  remaining: bigint;
  claimable: bigint;
};

export type DaoUserRole = {
  isCreator: boolean;
  isAdmin: boolean;
  isFinanceManager: boolean;
  isVerifiedMember: boolean;
};

export type WithdrawableStakeRow = {
  daoAddress: Address;
  daoName: string;
  investmentId: number;
  investmentName: string;
  withdrawableAmount: bigint;
};

export type DaoParticipant = {
  address: Address;
  role: "creator" | "admin" | "finance_manager" | "member";
};

export type WalletDaoRoleRow = {
  daoAddress: Address;
  daoName: string;
  location: string;
  isCreator: boolean;
  isAdmin: boolean;
  isFinanceManager: boolean;
  isVerifiedMember: boolean;
};

function formatUsdc(value: bigint): string {
  const asNumber = Number(formatUnits(value, 6));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(asNumber) ? asNumber : 0);
}

function getWalletClient(wallet: PrivyEthereumWallet) {
  return wallet.getEthereumProvider().then((provider) =>
    createWalletClient({
      account: wallet.address as Address,
      chain: APP_CHAIN,
      transport: custom(provider as any),
    })
  );
}

export function formatUsdcAmount(raw: bigint): string {
  return formatUsdc(raw);
}

export function statusLabel(status: InvestmentStatus): "Proposed" | "Active" | "Completed" | "Incomplete" {
  if (status === 0) return "Proposed";
  if (status === 1) return "Active";
  if (status === 2) return "Completed";
  return "Incomplete";
}

export async function fetchDaoUserRole(
  daoAddress: Address,
  walletAddress: Address
): Promise<DaoUserRole> {
  const [creator, adminFlag, financeFlag, verifiedFlag] = await Promise.all([
    publicClient.readContract({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "creator",
    }),
    publicClient.readContract({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "isAdmin",
      args: [walletAddress],
    }),
    publicClient.readContract({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "isFinanceManager",
      args: [walletAddress],
    }),
    publicClient.readContract({
      address: daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "isVerifiedMember",
      args: [walletAddress],
    }),
  ]);

  return {
    isCreator: creator.toLowerCase() === walletAddress.toLowerCase(),
    isAdmin: adminFlag,
    isFinanceManager: financeFlag,
    isVerifiedMember: verifiedFlag,
  };
}

export async function createDaoOnFactory(
  wallet: PrivyEthereumWallet,
  input: CreateDaoInput
): Promise<CreateDaoResult> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);

  const { request } = await publicClient.simulateContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "createDAO",
    args: [
      input.name,
      input.description,
      input.location,
      input.coordinates,
      input.postalCode,
      input.maxMembership,
      USDC_ADDRESS,
    ],
    account: wallet.address as Address,
  });

  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  let daoAddress: Address | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== FACTORY_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "DAOCreated") {
        daoAddress = decoded.args.daoAddress as Address;
        break;
      }
    } catch {
      // Skip unknown logs.
    }
  }

  return { txHash, daoAddress };
}

export async function fetchActiveDaos(): Promise<OnchainDao[]> {
  let activeAddresses: Address[] = [];
  try {
    activeAddresses = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getActiveDAOs",
    });
  } catch {
    // Some deployed factory variants may not expose getActiveDAOs reliably.
    // Fallback to getAllDAOs and filter against daoInfo.isActive.
    const allAddresses = await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: "getAllDAOs",
    });
    const checks = await Promise.all(
      allAddresses.map(async (daoAddress) => {
        try {
          const meta = await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: FACTORY_ABI,
            functionName: "daoInfo",
            args: [daoAddress],
          });
          return meta[4] ? daoAddress : null;
        } catch {
          return null;
        }
      })
    );
    activeAddresses = checks.filter((address): address is Address => Boolean(address));
  }

  const daos = await Promise.all(
    activeAddresses.map(async (daoAddress) => {
      const [meta, description, memberCount, tvlRaw] = await Promise.all([
        publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: "daoInfo",
          args: [daoAddress],
        }),
        publicClient.readContract({
          address: daoAddress,
          abi: LOCAL_DAO_ABI,
          functionName: "description",
        }),
        publicClient.readContract({
          address: daoAddress,
          abi: LOCAL_DAO_ABI,
          functionName: "memberCount",
        }),
        publicClient.readContract({
          address: daoAddress,
          abi: LOCAL_DAO_ABI,
          functionName: "totalValueLocked",
        }),
      ]);

      return {
        address: daoAddress,
        name: meta[0],
        location: meta[1],
        creator: meta[2],
        createdAt: meta[3],
        isActive: meta[4],
        description,
        memberCount: Number(memberCount),
        tvlRaw,
        tvlFormatted: formatUsdc(tvlRaw),
      };
    })
  );

  return daos.sort((a, b) => Number(b.createdAt - a.createdAt));
}

export async function getPrimaryDaoAddress(): Promise<Address | null> {
  const daos = await fetchActiveDaos();
  return daos[0]?.address ?? null;
}

export async function fetchAllInvestments(): Promise<OnchainInvestment[]> {
  const daos = await fetchActiveDaos();

  const allByDao = await Promise.all(
    daos.map(async (dao) => {
      const count = await publicClient.readContract({
        address: dao.address,
        abi: LOCAL_DAO_ABI,
        functionName: "investmentCount",
      });

      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
      const investments = await Promise.all(
        ids.map((id) =>
          publicClient.readContract({
            address: dao.address,
            abi: LOCAL_DAO_ABI,
            functionName: "getInvestment",
            args: [id],
          })
        )
      );

      return investments.map((investment) => ({
        daoAddress: dao.address,
        daoName: dao.name,
        id: Number(investment.id),
        name: investment.name,
        status: investment.status as InvestmentStatus,
        category: Number(investment.category),
        deadline: investment.deadline,
        upvotes: investment.upvotes,
        downvotes: investment.downvotes,
        fundNeeded: investment.fundNeeded,
        expectedYield: investment.expectedYield,
        grade: Number(investment.grade),
        totalYieldGenerated: investment.totalYieldGenerated,
        totalYieldDistributed: investment.totalYieldDistributed,
        createdAt: investment.createdAt,
      }));
    })
  );

  return allByDao
    .flat()
    .sort((a, b) => Number(b.createdAt - a.createdAt));
}

export async function createInvestmentOnDao(
  wallet: PrivyEthereumWallet,
  input: InvestmentCreateInput
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;
  const fundNeededRaw = parseUnits(input.fundNeededUsdc || "0", 6);

  if (!input.name.trim()) throw new Error("Proposal name is required.");
  if (fundNeededRaw <= 0n) throw new Error("Fund needed must be greater than zero.");
  if (!Number.isFinite(input.expectedYieldPct) || input.expectedYieldPct < 0 || input.expectedYieldPct > 100) {
    throw new Error("Expected yield must be between 0 and 100.");
  }
  if (!Number.isFinite(input.deadlineDays) || input.deadlineDays < 1 || input.deadlineDays > 365) {
    throw new Error("Deadline must be between 1 and 365 days.");
  }
  if (!Number.isFinite(input.category) || input.category < 0 || input.category > 7) {
    throw new Error("Invalid category.");
  }
  if (!Number.isFinite(input.grade) || input.grade < 0 || input.grade > 3) {
    throw new Error("Invalid grade.");
  }

  const { request } = await publicClient.simulateContract({
    address: input.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "createInvestment",
    args: [
      input.name.trim(),
      input.category,
      fundNeededRaw,
      BigInt(Math.floor(input.expectedYieldPct)),
      input.grade,
      BigInt(Math.floor(input.deadlineDays)),
      input.documentCids && input.documentCids.length > 0 ? input.documentCids : [],
    ],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function fetchDaoParticipants(daoAddress: Address): Promise<DaoParticipant[]> {
  const creator = await publicClient.readContract({
    address: daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "creator",
  });

  const members = await publicClient.readContract({
    address: daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "getAllMembers",
  });

  let adminAdded: Array<{ args: { admin: Address } }> = [];
  let adminRemoved: Array<{ args: { admin: Address } }> = [];
  let fmAdded: Array<{ args: { manager: Address } }> = [];
  let fmRemoved: Array<{ args: { manager: Address } }> = [];

  try {
    const [added, removed, fmAdd, fmRem] = await Promise.all([
      getLogsWithRpcFallback({
        address: daoAddress,
        event: {
          type: "event",
          name: "AdminAdded",
          inputs: [{ indexed: true, name: "admin", type: "address" }],
        },
        fromBlock: 0n,
        toBlock: "latest",
      }),
      getLogsWithRpcFallback({
        address: daoAddress,
        event: {
          type: "event",
          name: "AdminRemoved",
          inputs: [{ indexed: true, name: "admin", type: "address" }],
        },
        fromBlock: 0n,
        toBlock: "latest",
      }),
      getLogsWithRpcFallback({
        address: daoAddress,
        event: {
          type: "event",
          name: "FinanceManagerAdded",
          inputs: [{ indexed: true, name: "manager", type: "address" }],
        },
        fromBlock: 0n,
        toBlock: "latest",
      }),
      getLogsWithRpcFallback({
        address: daoAddress,
        event: {
          type: "event",
          name: "FinanceManagerRemoved",
          inputs: [{ indexed: true, name: "manager", type: "address" }],
        },
        fromBlock: 0n,
        toBlock: "latest",
      }),
    ]);
    adminAdded = added as Array<{ args: { admin: Address } }>;
    adminRemoved = removed as Array<{ args: { admin: Address } }>;
    fmAdded = fmAdd as Array<{ args: { manager: Address } }>;
    fmRemoved = fmRem as Array<{ args: { manager: Address } }>;
  } catch {
    // Some public RPCs block eth_getLogs/CORS. Keep dialog functional with creator + members.
  }

  const adminSet = new Set<Address>();
  for (const log of adminAdded) adminSet.add(log.args.admin as Address);
  for (const log of adminRemoved) adminSet.delete(log.args.admin as Address);

  const fmSet = new Set<Address>();
  for (const log of fmAdded) fmSet.add(log.args.manager as Address);
  for (const log of fmRemoved) fmSet.delete(log.args.manager as Address);

  const byAddress = new Map<string, DaoParticipant>();
  byAddress.set(creator.toLowerCase(), { address: creator, role: "creator" });

  for (const admin of adminSet) {
    const key = admin.toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, { address: admin, role: "admin" });
  }
  for (const manager of fmSet) {
    const key = manager.toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, { address: manager, role: "finance_manager" });
  }
  for (const member of members) {
    const key = member.toLowerCase();
    if (!byAddress.has(key)) byAddress.set(key, { address: member, role: "member" });
  }

  return Array.from(byAddress.values());
}

export async function fetchParticipantUpvotes(
  daoAddress: Address,
  investmentId: number,
  participants: Address[]
): Promise<Record<string, bigint>> {
  const rows = await Promise.all(
    participants.map(async (participant) => {
      const vote = await publicClient.readContract({
        address: daoAddress,
        abi: LOCAL_DAO_ABI,
        functionName: "getVote",
        args: [BigInt(investmentId), participant],
      });
      const upvotes = vote.voteValue === 1 ? vote.numberOfVotes : 0n;
      return [participant.toLowerCase(), upvotes] as const;
    })
  );
  return Object.fromEntries(rows);
}

export async function voteOnInvestment(
  wallet: PrivyEthereumWallet,
  params: {
    daoAddress: Address;
    investmentId: number;
    voteValue: 0 | 1;
    upvoteAmountUsdc?: string;
  }
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;

  let amountRaw = 0n;
  if (params.voteValue === 1) {
    amountRaw = parseUnits(params.upvoteAmountUsdc || "0", 6);
    if (amountRaw <= 0n) throw new Error("Enter a valid USDC amount for upvote.");

    const balance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account],
    });
    if (balance < amountRaw) {
      throw new Error("Insufficient USDC balance for this vote amount.");
    }

    const allowance = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account, params.daoAddress],
    });

    if (allowance < amountRaw) {
      const { request: approveRequest } = await publicClient.simulateContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [params.daoAddress, amountRaw],
        account,
      });
      const approveHash = await walletClient.writeContract(approveRequest);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  const { request } = await publicClient.simulateContract({
    address: params.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "vote",
    args: [BigInt(params.investmentId), amountRaw, params.voteValue],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function fetchYieldRows(userAddress?: Address): Promise<YieldRow[]> {
  const investments = await fetchAllInvestments();

  const withYield = investments.filter(
    (investment) => investment.totalYieldGenerated > 0n || investment.status === 1
  );

  const rows = await Promise.all(
    withYield.map(async (investment) => {
      const distribution = await publicClient.readContract({
        address: investment.daoAddress,
        abi: LOCAL_DAO_ABI,
        functionName: "getYieldDistribution",
        args: [BigInt(investment.id)],
      });

      const claimable =
        userAddress == null
          ? 0n
          : await publicClient.readContract({
              address: investment.daoAddress,
              abi: LOCAL_DAO_ABI,
              functionName: "calculateClaimableYield",
              args: [BigInt(investment.id), userAddress],
            });

      return {
        daoAddress: investment.daoAddress,
        daoName: investment.daoName,
        investmentId: investment.id,
        investmentName: investment.name,
        totalYield: distribution.totalAmount,
        distributed: distribution.distributedAmount,
        remaining: distribution.remainingAmount,
        claimable,
      };
    })
  );

  return rows.sort((a, b) => Number(b.totalYield - a.totalYield));
}

export async function claimInvestmentYield(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;

  const { request } = await publicClient.simulateContract({
    address: daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "claimYield",
    args: [BigInt(investmentId)],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function depositInvestmentYield(
  wallet: PrivyEthereumWallet,
  params: {
    daoAddress: Address;
    investmentId: number;
    amountUsdc: string;
    expenseReportCID: string;
  }
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;
  const amountRaw = parseUnits(params.amountUsdc || "0", 6);
  if (amountRaw <= 0n) throw new Error("Yield amount must be greater than zero.");

  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account, params.daoAddress],
  });

  if (allowance < amountRaw) {
    const { request: approveRequest } = await publicClient.simulateContract({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [params.daoAddress, amountRaw],
      account,
    });
    const approveHash = await walletClient.writeContract(approveRequest);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const { request } = await publicClient.simulateContract({
    address: params.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "depositYield",
    args: [BigInt(params.investmentId), amountRaw, params.expenseReportCID],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function extendInvestmentDeadline(
  wallet: PrivyEthereumWallet,
  params: {
    daoAddress: Address;
    investmentId: number;
    additionalDays: number;
  }
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;
  if (!Number.isFinite(params.additionalDays) || params.additionalDays < 1 || params.additionalDays > 90) {
    throw new Error("Extension must be between 1 and 90 days.");
  }

  const { request } = await publicClient.simulateContract({
    address: params.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "extendDeadline",
    args: [BigInt(params.investmentId), BigInt(params.additionalDays)],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function withdrawInvestmentStake(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;

  const { request } = await publicClient.simulateContract({
    address: daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "withdrawStake",
    args: [BigInt(investmentId)],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function fetchWithdrawableStakeRows(
  userAddress?: Address
): Promise<WithdrawableStakeRow[]> {
  if (!userAddress) return [];
  const investments = await fetchAllInvestments();
  const incomplete = investments.filter((investment) => investment.status === 3);
  if (incomplete.length === 0) return [];

  const rows = await Promise.all(
    incomplete.map(async (investment) => {
      const withdrawableAmount = await publicClient.readContract({
        address: investment.daoAddress,
        abi: LOCAL_DAO_ABI,
        functionName: "getWithdrawableAmount",
        args: [BigInt(investment.id), userAddress],
      });

      return {
        daoAddress: investment.daoAddress,
        daoName: investment.daoName,
        investmentId: investment.id,
        investmentName: investment.name,
        withdrawableAmount,
      };
    })
  );

  return rows.filter((row) => row.withdrawableAmount > 0n);
}

export function deriveKycProofHash(reference: string): Hex {
  const normalized = reference.trim();
  if (!normalized) throw new Error("Proof reference is required.");
  return keccak256(toHex(normalized));
}

export async function addMemberToDao(
  wallet: PrivyEthereumWallet,
  params: {
    daoAddress: Address;
    memberWallet: Address;
    proofReference?: string;
  }
): Promise<{ txHash: Hex; kycProofHash: Hex; proofReferenceUsed: string }> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;

  const [creator, adminFlag] = await Promise.all([
    publicClient.readContract({
      address: params.daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "creator",
    }),
    publicClient.readContract({
      address: params.daoAddress,
      abi: LOCAL_DAO_ABI,
      functionName: "isAdmin",
      args: [account],
    }),
  ]);
  if (creator.toLowerCase() !== account.toLowerCase() && !adminFlag) {
    throw new Error("Connected wallet is not creator/admin for selected DAO.");
  }

  const proofReferenceUsed =
    params.proofReference?.trim() ||
    `manual://localdao/${params.memberWallet.toLowerCase()}/${Date.now()}`;
  const kycProofHash = deriveKycProofHash(proofReferenceUsed);

  const { request } = await publicClient.simulateContract({
    address: params.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "addMember",
    args: [params.memberWallet, kycProofHash],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash, kycProofHash, proofReferenceUsed };
}

async function writeDaoContract(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  functionName:
    | "verifyMemberKYC"
    | "removeMember"
    | "addAdmin"
    | "removeAdmin"
    | "addFinanceManager"
    | "removeFinanceManager"
    | "activateInvestment"
    | "markInvestmentIncomplete"
    | "closeInvestment"
    | "pause"
    | "unpause"
    | "sweepUnclaimedYield",
  args: readonly unknown[] = []
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;
  const { request } = await publicClient.simulateContract({
    address: daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName,
    args,
    account,
  });
  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function verifyMemberOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  memberWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "verifyMemberKYC", [memberWallet]);
}

export async function removeMemberOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  memberWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "removeMember", [memberWallet]);
}

export async function addAdminOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  adminWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "addAdmin", [adminWallet]);
}

export async function removeAdminOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  adminWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "removeAdmin", [adminWallet]);
}

export async function addFinanceManagerOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  managerWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "addFinanceManager", [managerWallet]);
}

export async function removeFinanceManagerOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  managerWallet: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "removeFinanceManager", [managerWallet]);
}

export async function activateInvestmentOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "activateInvestment", [BigInt(investmentId)]);
}

export async function markInvestmentIncompleteOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "markInvestmentIncomplete", [BigInt(investmentId)]);
}

export async function closeInvestmentOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "closeInvestment", [BigInt(investmentId)]);
}

export async function sweepUnclaimedYieldOnDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address,
  investmentId: number,
  recipient: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "sweepUnclaimedYield", [BigInt(investmentId), recipient]);
}

export async function pauseDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "pause", []);
}

export async function unpauseDao(
  wallet: PrivyEthereumWallet,
  daoAddress: Address
): Promise<Hex> {
  return writeDaoContract(wallet, daoAddress, "unpause", []);
}

export async function fetchWalletDaoRoles(walletAddress?: Address): Promise<WalletDaoRoleRow[]> {
  if (!walletAddress) return [];
  const daos = await fetchActiveDaos();
  const rows = await Promise.all(
    daos.map(async (dao) => {
      const role = await fetchDaoUserRole(dao.address, walletAddress);
      return {
        daoAddress: dao.address,
        daoName: dao.name,
        location: dao.location,
        ...role,
      };
    })
  );
  return rows.filter((row) => row.isCreator || row.isAdmin || row.isFinanceManager || row.isVerifiedMember);
}

export async function updateDaoInfoOnchain(
  wallet: PrivyEthereumWallet,
  params: {
    daoAddress: Address;
    description: string;
    logoURI: string;
  }
): Promise<Hex> {
  await wallet.switchChain(APP_CHAIN_ID);
  const walletClient = await getWalletClient(wallet);
  const account = wallet.address as Address;

  const { request } = await publicClient.simulateContract({
    address: params.daoAddress,
    abi: LOCAL_DAO_ABI,
    functionName: "updateDAOInfo",
    args: [params.description, params.logoURI],
    account,
  });

  const txHash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

export async function fetchAdminManagedDaos(walletAddress?: Address): Promise<OnchainDao[]> {
  if (!walletAddress) return [];
  const allDaos = await fetchActiveDaos();
  const checks = await Promise.all(
    allDaos.map(async (dao) => {
      const [creator, adminFlag] = await Promise.all([
        publicClient.readContract({
          address: dao.address,
          abi: LOCAL_DAO_ABI,
          functionName: "creator",
        }),
        publicClient.readContract({
          address: dao.address,
          abi: LOCAL_DAO_ABI,
          functionName: "isAdmin",
          args: [walletAddress],
        }),
      ]);
      return creator.toLowerCase() === walletAddress.toLowerCase() || adminFlag;
    })
  );
  return allDaos.filter((_, idx) => checks[idx]);
}
