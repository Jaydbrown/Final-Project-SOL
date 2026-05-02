/**
 * Vite exposes env via import.meta.env. Node-style NEXT_PUBLIC_/REACT_APP_ vars
 * are not injected unless configured, so chats/notifications hits must use VITE_BACKEND_URL.
 */
const raw =
  typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env?.VITE_BACKEND_URL
    : undefined;

export const BACKEND_URL =
  typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "http://localhost:3001";
