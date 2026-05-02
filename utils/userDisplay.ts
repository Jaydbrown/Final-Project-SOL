import { maskAddress } from "./address";

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const MASKED_ADDRESS_REGEX = /^0x[a-fA-F0-9]{4,}\.\.\.[a-fA-F0-9]{4}$/;

const FRIENDLY_ADJECTIVES = [
  "Calm",
  "Bright",
  "Brave",
  "Swift",
  "Golden",
  "Noble",
  "Wise",
  "Keen",
] as const;
const FRIENDLY_NOUNS = [
  "River",
  "Palm",
  "Eagle",
  "Cedar",
  "Sun",
  "Wave",
  "Stone",
  "Harbor",
] as const;

const toReadableWords = (value: string) =>
  value
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const readStringPath = (value: unknown, path: string[]): string => {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current.trim() : "";
};

export const generateMemberName = (walletAddress: string) => {
  if (!ADDRESS_REGEX.test(walletAddress)) return "Community Member";
  let hash = 0;
  for (const char of walletAddress.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000003;
  }
  const adjective = FRIENDLY_ADJECTIVES[hash % FRIENDLY_ADJECTIVES.length];
  const noun = FRIENDLY_NOUNS[Math.floor(hash / FRIENDLY_ADJECTIVES.length) % FRIENDLY_NOUNS.length];
  return `Member ${adjective} ${noun}`;
};

const isWalletLikeLabel = (value: string) =>
  ADDRESS_REGEX.test(value) || MASKED_ADDRESS_REGEX.test(value);

/**
 * Friendly name for the signed-in user (Google/Gmail first, then other OAuth, email local-part, then deterministic nickname).
 */
export const getAccountDisplayName = (user: unknown, walletAddress: string) => {
  const paths: string[][] = [
    ["google", "name"],
    ["google", "givenName"],
    ["displayName"],
    ["name"],
    ["apple", "name"],
    ["discord", "username"],
    ["twitter", "name"],
    ["github", "username"],
  ];
  for (const path of paths) {
    const name = readStringPath(user, path);
    if (name) return toReadableWords(name);
  }

  const email = readStringPath(user, ["email", "address"]);
  if (email) {
    const localPart = email.split("@")[0] ?? "";
    if (localPart) return toReadableWords(localPart);
  }

  return generateMemberName(walletAddress || "0x0000000000000000000000000000000000000000");
};

export const normalizeMemberLabel = (label: string, senderWallet: string) => {
  const trimmed = label.trim();
  if (!trimmed || isWalletLikeLabel(trimmed)) {
    return generateMemberName(senderWallet);
  }
  return toReadableWords(trimmed);
};

/** Single letter for avatar chips */
export const getAccountInitial = (displayName: string, emailFallback?: string) => {
  const source = displayName.trim() || emailFallback?.trim() || "";
  if (!source) return "U";
  return source.charAt(0).toUpperCase();
};

/** Wallet shown only as masked hex (never full address in UI strings). */
export const formatWalletEncapsulated = (address: string | undefined, start = 4, end = 4) =>
  address ? maskAddress(address, start, end) : "";
