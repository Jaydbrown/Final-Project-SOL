import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Card } from "../components/UI";
import { ArrowLeft, MessageSquare, Search, Send } from "lucide-react";
import { type OnchainDao, fetchActiveDaos } from "../utils/localDaoContracts";
import { maskAddress } from "../utils/address";
import {
  getDaoChatTransportLabel,
  loadDaoChatMessages,
  sendDaoChatMessage,
  subscribeDaoChat,
  type DaoChatMessage,
} from "../utils/daoChat";
import { formatTxError, notifyError, notifySuccess, notifyWarning } from "../utils/toast";

type RoomSummary = {
  lastMessage: DaoChatMessage | null;
  unreadCount: number;
};

const LAST_SEEN_KEY = "localdao_chat_last_seen_by_room";

const readLastSeen = (): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLastSeen = (value: Record<string, number>) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(value));
};

const formatRoomTimestamp = (createdAt: number) => {
  const date = new Date(createdAt);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatMessageTimestamp = (createdAt: number) => {
  return new Date(createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const MessagesView: React.FC = () => {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [daos, setDaos] = useState<OnchainDao[]>([]);
  const [selectedDao, setSelectedDao] = useState<OnchainDao | null>(null);
  const [messages, setMessages] = useState<DaoChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomSummaries, setRoomSummaries] = useState<Record<string, RoomSummary>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileShowRooms, setMobileShowRooms] = useState(true);
  const [error, setError] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeWallet = useMemo(
    () => wallets.find((wallet) => wallet.type === "ethereum") ?? null,
    [wallets],
  );
  const walletAddress = activeWallet?.address ?? "";

  const senderLabel = useMemo(() => {
    const email = user?.email?.address;
    if (email) return email;
    if (!walletAddress) return "Anonymous";
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [user, walletAddress]);

  const loadRoomSummaries = async (daoRows: OnchainDao[]) => {
    if (daoRows.length === 0) {
      setRoomSummaries({});
      return;
    }
    try {
      const result = await Promise.all(
        daoRows.map(async (dao) => {
          const roomMessages = await loadDaoChatMessages(dao.address, 200);
          const lastMessage = roomMessages[roomMessages.length - 1] ?? null;
          const lastSeenMap = readLastSeen();
          const seenAt = lastSeenMap[dao.address.toLowerCase()] ?? 0;
          const unreadCount = roomMessages.filter((msg) => msg.createdAt > seenAt).length;
          return [dao.address.toLowerCase(), { lastMessage, unreadCount }] as const;
        }),
      );
      setRoomSummaries(Object.fromEntries(result));
    } catch {
      setRoomSummaries({});
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const daoRows = await fetchActiveDaos();
        setDaos(daoRows);
        setSelectedDao((current) => current ?? daoRows[0] ?? null);
        await loadRoomSummaries(daoRows);
        setError("");
      } catch (err) {
        const message = formatTxError(err, "Failed to load communities.");
        setError(message);
        notifyError(message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!selectedDao) {
      setMessages([]);
      return;
    }
    const runSync = async () => {
      try {
        const next = await loadDaoChatMessages(selectedDao.address);
        setMessages(next);
      } catch (err) {
        const message = formatTxError(err, "Failed to sync messages.");
        notifyError(message);
      }
    };
    const sync = () => {
      void runSync();
    };
    sync();
    return subscribeDaoChat(selectedDao.address, sync);
  }, [selectedDao]);

  useEffect(() => {
    if (!selectedDao) return;
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    const map = readLastSeen();
    map[selectedDao.address.toLowerCase()] = lastMessage.createdAt;
    writeLastSeen(map);
    setRoomSummaries((current) => ({
      ...current,
      [selectedDao.address.toLowerCase()]: {
        lastMessage,
        unreadCount: 0,
      },
    }));
  }, [selectedDao?.address, messages]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
  }, [messages.length, selectedDao?.address]);

  useEffect(() => {
    void loadRoomSummaries(daos);
  }, [daos.length]);

  const filteredDaos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return daos;
    return daos.filter(
      (dao) => dao.name.toLowerCase().includes(q) || dao.location.toLowerCase().includes(q),
    );
  }, [daos, searchTerm]);

  const roomMessages = useMemo(() => {
    return messages.map((msg) => ({
      ...msg,
      mine: walletAddress ? msg.senderWallet.toLowerCase() === walletAddress.toLowerCase() : false,
    }));
  }, [messages, walletAddress]);

  const handleSend = async () => {
    if (!selectedDao) return;
    try {
      if (!walletAddress) {
        notifyWarning("Connect your wallet first to send messages.");
        return;
      }
      if (!draft.trim()) return;
      setSending(true);
      await sendDaoChatMessage({
        daoAddress: selectedDao.address,
        senderWallet: walletAddress,
        senderLabel,
        content: draft,
      });
      setDraft("");
      const next = await loadDaoChatMessages(selectedDao.address);
      setMessages(next);
      await loadRoomSummaries(daos);
      notifySuccess("Message sent.");
    } catch (err) {
      const message = formatTxError(err, "Failed to send message.");
      notifyError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community Chat</h1>
          <p className="text-slate-500 mt-1">Real-time rooms, one room per DAO.</p>
        </div>
        {/* <p className="text-xs text-slate-400">Transport: {getDaoChatTransportLabel()}</p> */}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading DAO rooms...</p>
      ) : error ? (
        <Card className="p-8">
          <p className="text-slate-500">{error}</p>
        </Card>
      ) : daos.length === 0 ? (
        <Card className="p-8">
          <p className="text-slate-500">No active DAO rooms available.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden min-h-[72vh]">
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] h-full">
            <aside className={`border-r border-slate-200 bg-white ${mobileShowRooms ? "block" : "hidden lg:block"}`}>
              <div className="p-4 border-b border-slate-100 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Rooms</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search DAO room"
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="h-[calc(72vh-92px)] lg:h-[calc(72vh-92px)] overflow-y-auto p-2 space-y-1">
                {filteredDaos.map((dao) => {
                  const summary = roomSummaries[dao.address.toLowerCase()];
                  const isSelected = selectedDao?.address.toLowerCase() === dao.address.toLowerCase();
                  return (
                    <button
                      key={dao.address}
                      onClick={() => {
                        setSelectedDao(dao);
                        setMobileShowRooms(false);
                      }}
                      className={`w-full text-left rounded-xl px-3 py-3 border transition ${
                        isSelected
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-transparent hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-slate-900 text-sm line-clamp-1">{dao.name}</p>
                        {summary?.unreadCount ? (
                          <span className="min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                            {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">{maskAddress(dao.address)}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {summary?.lastMessage?.content ?? "No messages yet"}
                        </p>
                        {summary?.lastMessage ? (
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {formatRoomTimestamp(summary.lastMessage.createdAt)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className={`${mobileShowRooms ? "hidden lg:flex" : "flex"} flex-col bg-slate-50/50 min-h-[72vh]`}>
              <div className="p-4 border-b border-slate-100 bg-white flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setMobileShowRooms(true)}
                  className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
                  {selectedDao?.name?.charAt(0).toUpperCase() ?? "#"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate">{selectedDao?.name ?? "Select a room"}</p>
                  {selectedDao?.address && (
                    <p className="text-xs text-slate-500 truncate">{maskAddress(selectedDao.address)}</p>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
                  <MessageSquare className="w-4 h-4" />
                  {roomMessages.length}
                </div>
              </div>

              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {roomMessages.length === 0 ? (
                  <div className="h-full grid place-items-center text-center px-4">
                    <div>
                      <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 grid place-items-center mb-3">
                        <MessageSquare className="w-5 h-5 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">No messages yet. Start the conversation.</p>
                    </div>
                  </div>
                ) : (
                  roomMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[92%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${msg.mine ? "bg-emerald-600 text-white" : "bg-white border border-slate-200 text-slate-900"}`}>
                        <div className={`text-[11px] mb-1 ${msg.mine ? "text-emerald-100" : "text-slate-500"}`}>
                          {msg.mine ? "You" : msg.senderLabel}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <div className={`text-[10px] mt-1.5 ${msg.mine ? "text-emerald-100" : "text-slate-400"}`}>
                          {formatMessageTimestamp(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 sm:p-4 border-t border-slate-100 bg-white">
                <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!sending) void handleSend();
                      }
                    }}
                    rows={2}
                    placeholder={selectedDao ? "Type your message..." : "Select a room first"}
                    className="flex-1 p-3 border border-slate-200 rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!selectedDao || !draft.trim() || sending}
                    className="h-11 px-4 navy-bg text-white rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "Sending" : "Send"}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {walletAddress ? `Posting as ${maskAddress(walletAddress)}` : "Connect an Ethereum wallet in Privy to send messages."}
                  </p>
                  <p className="text-[11px] text-slate-400">{draft.length}/1000</p>
                </div>
              </div>
            </section>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MessagesView;
