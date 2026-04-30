const DEFAULT_EXPLORER_BASES = [
  "https://sepolia-blockscout.lisk.com",
];

function getExplorerBases(): string[] {
  const envRaw = ((import.meta.env.VITE_EXPLORER_URLS as string | undefined) ??
    (import.meta.env.VITE_FUJI_EXPLORER_URLS as string | undefined))?.trim();
  const fromEnv = envRaw
    ? envRaw.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  const bases = fromEnv.length > 0 ? fromEnv : DEFAULT_EXPLORER_BASES;
  return bases.map((base) => base.replace(/\/+$/, ""));
}

export function getTxExplorerUrl(txHash: string, index = 0): string {
  const bases = getExplorerBases();
  const base = bases[index] ?? bases[0];
  return `${base}/tx/${txHash}`;
}

export function getAddressExplorerUrl(address: string, index = 0): string {
  const bases = getExplorerBases();
  const base = bases[index] ?? bases[0];
  return `${base}/address/${address}`;
}

export function hasBackupExplorer(): boolean {
  return getExplorerBases().length > 1;
}
