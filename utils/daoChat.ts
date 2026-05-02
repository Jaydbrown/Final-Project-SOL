export type DaoChatMessage = {
  id: string;
  daoAddress: string;
  senderWallet: string;
  senderLabel: string;
  content: string;
  createdAt: number;
  /** Public HTTPS URL (e.g. Pinata gateway) — persisted via Supabase `attachment_url` when configured. */
  attachmentUrl?: string | null;
};

/** Session key: opening Messages from bell notification targets this DAO room. */
export const MESSAGES_NAV_DAO_STORAGE_KEY = "localdao_navigate_messages_dao";

const STORAGE_PREFIX = "localdao_chat_";
const CHANNEL_NAME = "localdao_chat_updates";
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const SUPABASE_ANON_KEY = (
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim()
);

const SUPABASE_SELECT_WITH_ATTACH =
  "id,room_key,sender_wallet,sender_label,content,created_at,attachment_url";
const SUPABASE_SELECT_BASE = "id,room_key,sender_wallet,sender_label,content,created_at";

const supabaseAttachmentColumnUnsupported = (status: number, body: string) =>
  status === 400 &&
  /attachment_url|42703|PGRST204|column .* does not exist|schema cache/i.test(body);
/** For `attachment_url` on messages, run `supabase-scripts/add-chat-attachment-url.sql` on your Supabase project. */
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

const hasAttachment = (msg: DaoChatMessage) =>
  typeof msg.attachmentUrl === "string" && Boolean(msg.attachmentUrl.trim());

/** True for Pinata/ipfs gateways and URLs that look like direct image blobs. */
function looksLikeRenderableImageUrl(s: string): boolean {
  const u = s.trim();
  if (!u.startsWith("https://") && !u.startsWith("http://")) return false;
  if (/\.(?:png|jpe?g|gif|webp)(?:\?[^\s]*)?$/i.test(u)) return true;
  if (/\/ipfs\/[a-zA-Z0-9]+/i.test(u)) return true;
  if (/pinata\.cloud\/ipfs\//i.test(u)) return true;
  if (/\.mypinata\.cloud\//i.test(u)) return true;
  if (/cloudflare-ipfs\.com\/ipfs\//i.test(u)) return true;
  return false;
}

function stripUrlFromCaption(content: string, url: string): string {
  const u = url.trim();
  let c = (content ?? "").trim();
  if (!u) return c;
  if (c === u) return "";
  if (c.endsWith(`\n\n${u}`)) return c.slice(0, -(u.length + 2)).trim();
  if (c.endsWith(`\n${u}`)) return c.slice(0, -(u.length + 1)).trim();
  const parts = c.split(/\n\s*\n/);
  if (parts.length >= 2 && parts[parts.length - 1]?.trim() === u) {
    return parts.slice(0, -1).join("\n\n").trim();
  }
  return c;
}

/**
 * When Supabase has no `attachment_url` column, sends store the gateway URL inside `content`.
 * Split that into attachmentUrl so the UI shows an image, not raw link text.
 */
function hydrateChatImageAttachment(msg: DaoChatMessage): DaoChatMessage {
  const existing = msg.attachmentUrl?.trim();
  if (existing && looksLikeRenderableImageUrl(existing)) {
    const stripped = stripUrlFromCaption(msg.content, existing);
    return { ...msg, attachmentUrl: existing, content: stripped };
  }

  const body = (msg.content ?? "").trim();
  if (!body) return msg;

  if (looksLikeRenderableImageUrl(body)) {
    return { ...msg, content: "", attachmentUrl: body };
  }

  const idx = body.lastIndexOf("\n\n");
  if (idx >= 0) {
    const head = body.slice(0, idx).trimEnd();
    const tail = body.slice(idx + 2).trim();
    if (tail && looksLikeRenderableImageUrl(tail)) {
      return { ...msg, content: head, attachmentUrl: tail };
    }
  }

  const nl = body.lastIndexOf("\n");
  if (nl >= 0) {
    const head = body.slice(0, nl).trimEnd();
    const tail = body.slice(nl + 1).trim();
    if (tail && looksLikeRenderableImageUrl(tail)) {
      return { ...msg, content: head, attachmentUrl: tail };
    }
  }

  return msg;
}

const parseMessages = (raw: string | null): DaoChatMessage[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DaoChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((msg) => {
        if (!msg || typeof msg.content !== "string" || typeof msg.createdAt !== "number") return false;
        return msg.content.trim().length > 0 || hasAttachment(msg as DaoChatMessage);
      })
      .map((msg) =>
        hydrateChatImageAttachment(msg as DaoChatMessage),
      )
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
    attachment_url?: string | null;
  }>,
): DaoChatMessage[] =>
  rows
    .map((row) =>
      hydrateChatImageAttachment({
        id: row.id,
        daoAddress: row.room_key,
        senderWallet: row.sender_wallet,
        senderLabel: row.sender_label,
        content: row.content ?? "",
        createdAt: new Date(row.created_at).getTime(),
        attachmentUrl: row.attachment_url?.trim() || undefined,
      }),
    )
    .sort((a, b) => a.createdAt - b.createdAt);

const loadDaoChatMessagesRemote = async (
  daoAddress: string,
  limit: number,
): Promise<DaoChatMessage[]> => {
  const roomKey = getRoomKey(daoAddress);

  const fetchWithSelect = async (select: string) => {
    const query = new URLSearchParams({
      select,
      room_key: `eq.${roomKey}`,
      order: "created_at.asc",
      limit: String(limit),
    });
    const response = await fetch(`${getSupabaseRestUrl()}?${query.toString()}`, {
      method: "GET",
      headers: supabaseHeaders(),
    });
    const body = await response.text();
    let rows: unknown[] = [];
    if (response.ok && body) {
      try {
        const parsed = JSON.parse(body) as unknown;
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        rows = [];
      }
    }
    return { ok: response.ok, status: response.status, body, rows };
  };

  let first = await fetchWithSelect(SUPABASE_SELECT_WITH_ATTACH);
  if (!first.ok && supabaseAttachmentColumnUnsupported(first.status, first.body)) {
    first = await fetchWithSelect(SUPABASE_SELECT_BASE);
  }

  if (!first.ok) {
    throw new Error(`Failed to load DAO chat messages: ${first.body || "unknown error"}`);
  }

  return fromSupabaseRows(
    first.rows as Array<{
      id: string;
      room_key: string;
      sender_wallet: string;
      sender_label: string;
      content: string;
      created_at: string;
      attachment_url?: string | null;
    }>,
  );
};

const sendDaoChatMessageRemote = async (params: {
  daoAddress: string;
  senderWallet: string;
  senderLabel: string;
  content: string;
  attachmentUrl?: string | null;
}): Promise<DaoChatMessage> => {
  const nowIso = new Date().toISOString();
  const attach = params.attachmentUrl?.trim() || "";
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const rowBase = {
    id,
    room_key: getRoomKey(params.daoAddress),
    sender_wallet: params.senderWallet,
    sender_label: params.senderLabel,
    content: params.content,
    created_at: nowIso,
  };

  const rowWithAttach = attach ? { ...rowBase, attachment_url: attach } : rowBase;

  const postRow = async (payload: Record<string, unknown>) => {
    const response = await fetch(getSupabaseRestUrl(), {
      method: "POST",
      headers: {
        ...supabaseHeaders(),
        Prefer: "return=representation",
      },
      body: JSON.stringify([payload]),
    });
    const bodyText = await response.text();
    let rows: unknown[] = [];
    if (response.ok && bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as unknown;
        if (Array.isArray(parsed)) rows = parsed;
      } catch {
        rows = [];
      }
    }
    return { ok: response.ok, status: response.status, bodyText, rows };
  };

  let attempt = await postRow(rowWithAttach);

  if (!attempt.ok && attach && supabaseAttachmentColumnUnsupported(attempt.status, attempt.bodyText)) {
    const merged = [params.content.trim(), attach].filter(Boolean).join("\n\n").slice(0, 1000);
    attempt = await postRow({ ...rowBase, content: merged });
  }

  if (!attempt.ok) {
    throw new Error(`Failed to send DAO chat message: ${attempt.bodyText || String(attempt.status)}`);
  }

  type Row = {
    id: string;
    room_key: string;
    sender_wallet: string;
    sender_label: string;
    content: string;
    created_at: string;
    attachment_url?: string | null;
  };
  const rows = attempt.rows as Row[];
  const [parsed] = fromSupabaseRows(rows);
  if (parsed) {
    if (attach && !parsed.attachmentUrl) return { ...parsed, attachmentUrl: attach };
    return parsed;
  }

  const createdTs = rows[0]?.created_at ? new Date(rows[0].created_at).getTime() : Date.now();
  return {
    id: rows[0]?.id ?? rowBase.id,
    daoAddress: rowBase.room_key,
    senderWallet: rowBase.sender_wallet,
    senderLabel: rowBase.sender_label,
    content: rows[0]?.content ?? rowBase.content,
    attachmentUrl: attach || undefined,
    createdAt: createdTs,
  };
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
  attachmentUrl?: string | null;
}): Promise<DaoChatMessage> => {
  const daoAddress = params.daoAddress.trim();
  const senderWallet = params.senderWallet.trim();
  const senderLabel = params.senderLabel.trim() || senderWallet;
  const content = params.content.trim();
  const attachmentUrl = params.attachmentUrl?.trim() || "";

  if (!daoAddress) throw new Error("DAO address is required.");
  if (!senderWallet) throw new Error("Sender wallet is required.");
  if (!content && !attachmentUrl) throw new Error("Message cannot be empty.");

  if (hasSupabaseConfig()) {
    return sendDaoChatMessageRemote({
      daoAddress,
      senderWallet,
      senderLabel,
      content: content.slice(0, 1000),
      attachmentUrl: attachmentUrl || undefined,
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
    attachmentUrl: attachmentUrl || undefined,
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
