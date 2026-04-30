export type DaoChatMessage = {
  id: string;
  daoAddress: string;
  senderWallet: string;
  senderLabel: string;
  content: string;
  createdAt: number;
};

const STORAGE_PREFIX = "localdao_chat_";
const CHANNEL_NAME = "localdao_chat_updates";
const SUPABASE_URL = (import.meta as ImportMeta & { env?: Record<string, string> }).env
  ?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as ImportMeta & { env?: Record<string, string> }).env
  ?.VITE_SUPABASE_ANON_KEY;
const SUPABASE_TABLE = "dao_chat_messages";
const SUPABASE_SCHEMA = "public";

const getStorageKey = (daoAddress: string) =>
  `${STORAGE_PREFIX}${daoAddress.toLowerCase()}`;

const getRoomKey = (daoAddress: string) => daoAddress.toLowerCase();

const canUseDom = () =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const hasSupabaseConfig = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const toWebsocketUrl = (url: string) => {
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
};

const getSupabaseRestUrl = () => `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`;
const getSupabaseRealtimeUrl = () =>
  `${toWebsocketUrl(SUPABASE_URL ?? "")}/realtime/v1/websocket?apikey=${encodeURIComponent(
    SUPABASE_ANON_KEY ?? "",
  )}&vsn=1.0.0`;

const supabaseHeaders = () => ({
  apikey: SUPABASE_ANON_KEY ?? "",
  Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ""}`,
  "Content-Type": "application/json",
});

const parseMessages = (raw: string | null): DaoChatMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DaoChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((msg) => msg && typeof msg.content === "string")
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
};

const readDaoMessages = (daoAddress: string): DaoChatMessage[] => {
  if (!canUseDom()) return [];
  return parseMessages(localStorage.getItem(getStorageKey(daoAddress)));
};

const writeDaoMessages = (daoAddress: string, messages: DaoChatMessage[]) => {
  if (!canUseDom()) return;
  localStorage.setItem(getStorageKey(daoAddress), JSON.stringify(messages));
};

const fromSupabaseRows = (
  rows: Array<{
    id: string;
    room_key: string;
    sender_wallet: string;
    sender_label: string;
    content: string;
    created_at: string;
  }>,
): DaoChatMessage[] =>
  rows
    .map((row) => ({
      id: row.id,
      daoAddress: row.room_key,
      senderWallet: row.sender_wallet,
      senderLabel: row.sender_label,
      content: row.content,
      createdAt: new Date(row.created_at).getTime(),
    }))
    .sort((a, b) => a.createdAt - b.createdAt);

const loadDaoChatMessagesRemote = async (
  daoAddress: string,
  limit: number,
): Promise<DaoChatMessage[]> => {
  const roomKey = getRoomKey(daoAddress);
  const query = new URLSearchParams({
    select: "id,room_key,sender_wallet,sender_label,content,created_at",
    room_key: `eq.${roomKey}`,
    order: "created_at.asc",
    limit: String(limit),
  });
  const response = await fetch(`${getSupabaseRestUrl()}?${query.toString()}`, {
    method: "GET",
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to load DAO chat messages: ${body || response.statusText}`);
  }
  const rows = (await response.json()) as Array<{
    id: string;
    room_key: string;
    sender_wallet: string;
    sender_label: string;
    content: string;
    created_at: string;
  }>;
  return fromSupabaseRows(rows);
};

const sendDaoChatMessageRemote = async (params: {
  daoAddress: string;
  senderWallet: string;
  senderLabel: string;
  content: string;
}): Promise<DaoChatMessage> => {
  const nowIso = new Date().toISOString();
  const row = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    room_key: getRoomKey(params.daoAddress),
    sender_wallet: params.senderWallet,
    sender_label: params.senderLabel,
    content: params.content,
    created_at: nowIso,
  };
  const response = await fetch(getSupabaseRestUrl(), {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to send DAO chat message: ${body || response.statusText}`);
  }
  const rows = (await response.json()) as Array<{
    id: string;
    room_key: string;
    sender_wallet: string;
    sender_label: string;
    content: string;
    created_at: string;
  }>;
  const [message] = fromSupabaseRows(rows);
  return (
    message ?? {
      id: row.id,
      daoAddress: row.room_key,
      senderWallet: row.sender_wallet,
      senderLabel: row.sender_label,
      content: row.content,
      createdAt: new Date(row.created_at).getTime(),
    }
  );
};

export const loadDaoChatMessages = (
  daoAddress: string,
  limit = 200,
): Promise<DaoChatMessage[]> => {
  if (!daoAddress) return Promise.resolve([]);
  if (hasSupabaseConfig()) {
    return loadDaoChatMessagesRemote(daoAddress, limit);
  }
  const messages = readDaoMessages(daoAddress);
  if (messages.length <= limit) return Promise.resolve(messages);
  return Promise.resolve(messages.slice(messages.length - limit));
};

export const sendDaoChatMessage = (params: {
  daoAddress: string;
  senderWallet: string;
  senderLabel: string;
  content: string;
}): Promise<DaoChatMessage> => {
  const daoAddress = params.daoAddress.trim();
  const senderWallet = params.senderWallet.trim();
  const senderLabel = params.senderLabel.trim() || senderWallet;
  const content = params.content.trim();

  if (!daoAddress) throw new Error("DAO address is required.");
  if (!senderWallet) throw new Error("Sender wallet is required.");
  if (!content) throw new Error("Message cannot be empty.");

  if (hasSupabaseConfig()) {
    return sendDaoChatMessageRemote({
      daoAddress,
      senderWallet,
      senderLabel,
      content: content.slice(0, 1000),
    });
  }

  const message: DaoChatMessage = {
    id:
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    daoAddress,
    senderWallet,
    senderLabel,
    content: content.slice(0, 1000),
    createdAt: Date.now(),
  };
  const messages = readDaoMessages(daoAddress);
  const next = [...messages, message].slice(-500);
  writeDaoMessages(daoAddress, next);

  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ daoAddress: daoAddress.toLowerCase() });
    channel.close();
  }

  return Promise.resolve(message);
};

export const subscribeDaoChat = (
  daoAddress: string,
  callback: () => void,
): (() => void) => {
  if (!daoAddress) return () => {};

  if (hasSupabaseConfig()) {
    if (typeof window === "undefined") return () => {};
    const ws = new WebSocket(getSupabaseRealtimeUrl());
    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    const roomKey = getRoomKey(daoAddress);
    const topic = `realtime:${SUPABASE_SCHEMA}:${SUPABASE_TABLE}`;
    const joinPayload = {
      topic,
      event: "phx_join",
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
          postgres_changes: [
            {
              event: "INSERT",
              schema: SUPABASE_SCHEMA,
              table: SUPABASE_TABLE,
              filter: `room_key=eq.${roomKey}`,
            },
          ],
        },
      },
      ref: "1",
    };

    ws.onopen = () => {
      ws.send(JSON.stringify(joinPayload));
      heartbeatId = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              topic: "phoenix",
              event: "heartbeat",
              payload: {},
              ref: String(Date.now()),
            }),
          );
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          event?: string;
          payload?: {
            data?: { record?: { room_key?: string } };
            record?: { room_key?: string };
          };
        };
        if (data.event === "postgres_changes") {
          const rowKey =
            data.payload?.data?.record?.room_key ?? data.payload?.record?.room_key ?? "";
          if (rowKey.toLowerCase() === roomKey) callback();
        }
      } catch {
        // Ignore malformed websocket payloads.
      }
    };

    return () => {
      if (heartbeatId) clearInterval(heartbeatId);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }

  if (!canUseDom()) return () => {};
  const key = getStorageKey(daoAddress);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key) callback();
  };
  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<{ daoAddress?: string }>) => {
      if (event.data?.daoAddress?.toLowerCase() === daoAddress.toLowerCase()) {
        callback();
      }
    };
  }

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.close();
  };
};

export const getDaoChatTransportLabel = () =>
  hasSupabaseConfig() ? "supabase-realtime" : "local-fallback";
