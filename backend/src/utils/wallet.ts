const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

/** Normalize Ethereum addresses so Prisma unique lookups stay consistent across clients. */
export function normalizeWalletAddress(address: unknown): string | undefined {
  if (typeof address !== "string") return undefined;
  const trimmed = address.trim().toLowerCase();
  return ADDR_RE.test(trimmed) ? trimmed : undefined;
}
