import React, { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/utils/backendUrl";
import { Loader2, MessageSquare, Send, Sparkles, X } from "lucide-react";

type Bubble = { role: "assistant" | "user"; content: string };

async function fetchReply(history: Bubble[]): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  if (!data.reply?.trim()) {
    throw new Error("Empty reply.");
  }
  return data.reply.trim();
}

function AssistantBadgeIcon({ size = "floating" }: { size?: "header" | "floating" }) {
  const shell =
    size === "header"
      ? "h-[19px] w-[19px] [&_svg.message-square]:stroke-[2.05]"
      : "h-[29px] w-[29px] [&_svg.message-square]:stroke-[2px]";
  const sparkleBox =
    size === "header"
      ? "h-[9px] w-[9px] -right-[1px] -top-[1px] stroke-[2.2]"
      : "h-[13px] w-[13px] -right-[2px] -top-[3px] stroke-[2.35]";
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${shell}`} aria-hidden>
      <MessageSquare className="message-square h-full w-full text-current drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
      <Sparkles
        className={`pointer-events-none absolute text-emerald-300 ${sparkleBox} drop-shadow-[0_0_6px_rgba(52,211,153,0.55)]`}
      />
    </span>
  );
}

const LandingAiChat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  /** Only user/model turns sent to the API (no standalone intro bubble). */
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setError(null);
    const userMsg: Bubble = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const conversationForApi = [...messages, userMsg];
      const reply = await fetchReply(conversationForApi);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(
        `${msg} Tip: run the backend with GEMINI_API_KEY set in backend/.env for local demos.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed z-[100] flex flex-col items-end gap-2 right-[max(0.75rem,env(safe-area-inset-right,0px)+0.5rem)] bottom-[max(0.75rem,env(safe-area-inset-bottom,0px)+0.5rem)]">
      {open && (
        <div
          className="w-[min(100vw-2rem,400px)] h-[min(70vh,480px)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 overflow-hidden"
          role="dialog"
          aria-label="LocalDAO assistant"
        >
          <div className="navy-bg text-white px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white/20 to-white/5 ring-1 ring-white/20">
                <AssistantBadgeIcon size="header" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">LocalDAO assistant</p>
                <p className="text-[11px] text-emerald-100/90 truncate">Answers about the product</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50/80"
          >
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl rounded-bl-md px-3 py-2 text-sm leading-relaxed bg-white border border-slate-200 text-slate-800">
                Hi—I can explain how LocalDAO works (DAOs on-chain, memberships, proposals, votes,
                yields). Ask anything in plain language.
              </div>
            </div>
            {messages.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "navy-bg text-white rounded-br-md"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="px-3 text-xs text-red-600 bg-red-50 border-t border-red-100 py-2">
              {error}
            </p>
          )}

          <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask about LocalDAO…"
              disabled={busy}
              className="flex-1 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="navy-bg text-white rounded-xl px-3 py-2 disabled:opacity-45 disabled:cursor-not-allowed hover:opacity-95 transition-opacity"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`group relative flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl text-white transition-[transform,box-shadow] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/55 focus-visible:ring-offset-2 ${
          open
            ? "scale-[0.97] bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 shadow-lg shadow-slate-900/40 ring-[3px] ring-white"
            : "bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#065f46] shadow-[0_12px_36px_-8px_rgba(6,78,59,0.65),0_0_0_1px_rgba(255,255,255,0.12)_inset] ring-[3px] ring-white hover:scale-105 hover:shadow-[0_16px_44px_-6px_rgba(16,185,129,0.42),0_0_0_1px_rgba(255,255,255,0.18)_inset] active:scale-[0.98]"
        }`}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
      >
        {open ? (
          <X className="h-7 w-7" strokeWidth={2.25} />
        ) : (
          <>
            <AssistantBadgeIcon size="floating" />
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(120% 80% at 30% 0%, rgba(52, 211, 153, 0.22) 0%, transparent 55%)",
              }}
            />
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/15" />
          </>
        )}
      </button>
    </div>
  );
};

export default LandingAiChat;
