"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ConversationsInboxPayload,
  InboxFilter,
  InboxMessage,
  InboxThread,
  InboxUser,
  KnowledgeGapInboxRow,
} from "./inbox-types";
import { cn } from "@/lib/utils";

function gapTypeLabel(type: string): string {
  switch (type) {
    case "no_retrieval":
      return "No sources retrieved";
    case "negative_feedback":
      return "Negative feedback";
    case "unhelpful_escalation":
      return "Unhelpful escalation";
    case "low_confidence_escalation":
      return "Low-confidence escalation";
    default:
      return type;
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFullWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function messageAuthor(m: InboxMessage): string {
  if (m.role === "user") return "Visitor";
  if (m.role === "human") return "Human";
  if (m.role === "assistant") return "Assistant";
  if (m.role === "system") return "System";
  return "System";
}

function conversationStatusLabel(thread: InboxThread): string {
  if (thread.conversationStatus === "human_active") return "human active";
  if (thread.conversationStatus === "human_pending") return "awaiting human";
  if (thread.conversationStatus === "awaiting_contact") return "awaiting contact";
  if (thread.conversationStatus === "resolved") return "resolved";
  return "AI active";
}

function MessageCitations({ citations }: { citations: InboxMessage["citations"] }) {
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;

  return (
    <div className="mt-2 border-t border-[var(--ink)]/10 pt-2">
      <button
        type="button"
        className="caption text-[0.65rem] underline lowercase"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Hide sources" : `Sources used (${citations.length})`}
      </button>
      {open ? (
        <ul className="mt-2 space-y-1.5">
          {citations.map((citation) => (
            <li
              key={`${citation.chunkId}-${citation.rank}`}
              className="caption text-[0.65rem] leading-snug"
            >
              <span className="font-medium">
                {citation.documentName ||
                  citation.sourceLabel ||
                  "Knowledge source"}
              </span>
              {citation.sourceLabel && citation.documentName ? (
                <span className="opacity-70"> · {citation.sourceLabel}</span>
              ) : null}
              {typeof citation.score === "number" ? (
                <span className="opacity-60">
                  {" "}
                  · score {citation.score.toFixed(2)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ConversationsInbox({
  payload,
}: {
  payload: ConversationsInboxPayload;
}) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<InboxFilter>(
    searchParams.get("filter") === "escalated"
      ? "escalated"
      : searchParams.get("filter") === "knowledge_gaps"
        ? "knowledge_gaps"
        : "all",
  );
  const [query, setQuery] = useState("");
  const [users] = useState<InboxUser[]>(payload.users);
  const [threads, setThreads] = useState<InboxThread[]>(payload.threads);
  const [knowledgeGaps] = useState<KnowledgeGapInboxRow[]>(
    payload.knowledgeGaps ?? [],
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    searchParams.get("user") ?? payload.users[0]?.id ?? null,
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    searchParams.get("thread") ?? null,
  );
  const [mobilePane, setMobilePane] = useState<"users" | "threads" | "messages">(
    "users",
  );
  const [busy, setBusy] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [messagesLoadedFor, setMessagesLoadedFor] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setThreads(payload.threads);
  }, [payload.threads]);

  const q = query.trim().toLowerCase();

  const filteredKnowledgeGaps = useMemo(() => {
    if (!q) return knowledgeGaps;
    return knowledgeGaps.filter((gap) => {
      const hay = `${gap.sampleQuestion} ${gap.pagePath ?? ""} ${gap.gapTypes.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [knowledgeGaps, q]);

  const openGapConversation = (gap: KnowledgeGapInboxRow) => {
    if (!gap.threadId) return;
    const thread = threads.find((t) => t.id === gap.threadId);
    if (!thread) return;
    setFilter("all");
    setSelectedUserId(thread.userId);
    setSelectedThreadId(thread.id);
    setMobilePane("messages");
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filter === "escalated" && u.escalatedCount === 0) return false;
      if (!q) return true;
      const hay = `${u.label} ${u.email ?? ""}`.toLowerCase();
      if (hay.includes(q)) return true;
      return threads.some(
        (t) =>
          t.userId === u.id &&
          `${t.title} ${t.preview}`.toLowerCase().includes(q),
      );
    });
  }, [filter, q, threads, users]);

  const userThreads = useMemo(() => {
    if (!selectedUserId) return [];
    return threads
      .filter((t) => t.userId === selectedUserId)
      .filter((t) => (filter === "escalated" ? t.escalated : true))
      .filter((t) => {
        if (!q) return true;
        const user = users.find((u) => u.id === t.userId);
        const hay =
          `${t.title} ${t.preview} ${user?.label ?? ""} ${user?.email ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (a.latestAt < b.latestAt ? 1 : -1));
  }, [filter, q, selectedUserId, threads, users]);

  const selectedThread =
    userThreads.find((t) => t.id === selectedThreadId) ??
    threads.find((t) => t.id === selectedThreadId) ??
    null;

  useEffect(() => {
    if (!selectedUserId && filteredUsers[0]) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    const list = userThreads;
    if (list.length === 0) {
      setSelectedThreadId(null);
      return;
    }
    if (!list.some((t) => t.id === selectedThreadId)) {
      setSelectedThreadId(list[0]!.id);
    }
  }, [selectedUserId, userThreads, selectedThreadId]);

  // Lazy-load messages when a thread is selected (list payload has none).
  useEffect(() => {
    if (!selectedThreadId) return;
    if (messagesLoadedFor === selectedThreadId) return;

    let cancelled = false;
    setLoadingMessages(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/conversations/${selectedThreadId}/messages`,
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: { messages: InboxMessage[] };
          error?: string;
        };
        if (cancelled) return;
        if (!json.success || !json.data) {
          setNote(json.error ?? "Failed to load messages");
          return;
        }
        setThreads((prev) =>
          prev.map((t) =>
            t.id === selectedThreadId
              ? { ...t, messages: json.data!.messages }
              : t,
          ),
        );
        setMessagesLoadedFor(selectedThreadId);
      } catch (e) {
        if (!cancelled) {
          setNote(e instanceof Error ? e.message : "Failed to load messages");
        }
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedThreadId, messagesLoadedFor]);

  const selectUser = (id: string) => {
    setSelectedUserId(id);
    setSelectedThreadId(null);
    setMobilePane("threads");
    setNote(null);
    setReply("");
  };

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
    setMobilePane("messages");
    setNote(null);
    setReply("");
  };

  const sendReply = async () => {
    if (!selectedThread || !reply.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/v1/conversations/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: selectedThread.id,
          action: "reply",
          content: reply.trim(),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { message: InboxMessage };
      };
      if (!json.success || !json.data?.message) {
        throw new Error(json.error ?? "Reply failed");
      }
      const msg = json.data.message;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThread.id
            ? {
                ...t,
                preview: msg.content.slice(0, 140),
                latestAt: msg.created_at,
                conversationStatus: "human_active",
                messages: [...t.messages, msg],
              }
            : t,
        ),
      );
      setReply("");
      setNote("Reply sent — visitor sees it in the widget");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="conversations-inbox" className="flex flex-col gap-3 h-[52rem] max-h-[52rem] min-h-[52rem] mb-10 sm:mb-12 lg:mb-14">
      <header className="shrink-0 space-y-1 min-w-0">
        <h1 id="conversations-heading" className="text-3xl sm:text-4xl">Conversations</h1>
        <p className="caption text-sm">
          Visitors and their chat threads. Search, filter, then take over when
          human needed.
        </p>
      </header>

      <div className="ink-card shrink-0 p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block space-y-1 flex-1 min-w-0">
          <span className="text-[0.6rem] tracking-[0.12em] uppercase opacity-60">
            Search
          </span>
          <input
            type="search"
            className="ink-input py-2 text-sm w-full"
            placeholder="Visitor, email, title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="block space-y-1 sm:w-48">
          <span className="text-[0.6rem] tracking-[0.12em] uppercase opacity-60">
            Show
          </span>
          <select
            className="ink-input py-2 text-sm lowercase w-full"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as InboxFilter);
              setSelectedThreadId(null);
            }}
          >
            <option value="all">all conversations</option>
            <option value="escalated">escalated</option>
            <option value="knowledge_gaps">knowledge gaps</option>
          </select>
        </label>
      </div>

      <div id="conversations-grid" className="ink-card flex-1 min-h-0 overflow-hidden grid lg:grid-cols-[minmax(0,14rem)_minmax(0,16rem)_minmax(0,1fr)]">
        {filter === "knowledge_gaps" ? (
          <section className="col-span-full flex flex-col h-full min-h-0 overflow-hidden">
            <div className="shrink-0 px-4 py-3 border-b border-[var(--ink)]/10">
              <h2 className="text-xl font-medium">Knowledge gaps</h2>
              <p className="caption text-sm">
                Repeated questions with weak retrieval, negative feedback, or
                unhelpful escalations (last 30 days).
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[var(--ink)]/10">
              {filteredKnowledgeGaps.length === 0 ? (
                <p className="p-6 caption text-sm">No knowledge gaps recorded yet.</p>
              ) : (
                filteredKnowledgeGaps.map((gap) => (
                  <div
                    key={`${gap.questionHash}:${gap.pagePath ?? ""}`}
                    className="px-4 py-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium leading-snug">
                          {gap.sampleQuestion}
                        </p>
                        <p className="caption text-[0.65rem]">
                          {gap.pagePath ? gap.pagePath : "unknown page"} ·{" "}
                          {gap.count} occurrence{gap.count === 1 ? "" : "s"} ·{" "}
                          {formatWhen(gap.latestAt)}
                        </p>
                      </div>
                      {gap.threadId ? (
                        <button
                          type="button"
                          className="btn-ink text-xs py-1.5 px-3 shrink-0"
                          onClick={() => openGapConversation(gap)}
                        >
                          open conversation
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {gap.gapTypes.map((type) => (
                        <span
                          key={type}
                          className="sticker sticker-lowercase text-[0.6rem] bg-[var(--cream)]"
                        >
                          {gapTypeLabel(type)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : (
          <>
        {/* Visitors — own scroll */}
        <aside
          className={cn(
            "border-b lg:border-b-0 lg:border-r border-[var(--ink)]/15 flex flex-col h-full min-h-0 overflow-hidden",
            mobilePane !== "users" && "hidden lg:flex",
          )}
        >
          <div className="shrink-0 px-3 py-2 border-b border-[var(--ink)]/10">
            <p className="caption text-xs lowercase">
              {filteredUsers.length} visitor
              {filteredUsers.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[var(--ink)]/10">
            {filteredUsers.length === 0 ? (
              <li className="p-4 caption text-sm">No visitors match.</li>
            ) : (
              filteredUsers.map((u) => {
                const active = u.id === selectedUserId;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => selectUser(u.id)}
                      className={cn(
                        "w-full text-left px-3 py-3 space-y-0.5 transition-colors",
                        active
                          ? "bg-[var(--cream)]"
                          : "hover:bg-[var(--cream)]/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium line-clamp-1">
                          {u.label}
                        </p>
                        <span className="caption text-[0.65rem] shrink-0">
                          {formatWhen(u.latestAt)}
                        </span>
                      </div>
                      {u.email ? (
                        <p className="caption text-[0.65rem] line-clamp-1">
                          {u.email}
                        </p>
                      ) : null}
                      <p className="caption text-[0.65rem] lowercase">
                        {u.threadCount} chat
                        {u.threadCount === 1 ? "" : "s"}
                        {u.escalatedCount > 0
                          ? ` · ${u.escalatedCount} escalated`
                          : ""}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Conversations — own scroll */}
        <aside
          className={cn(
            "border-b lg:border-b-0 lg:border-r border-[var(--ink)]/15 flex flex-col h-full min-h-0 overflow-hidden",
            mobilePane !== "threads" && "hidden lg:flex",
          )}
        >
          <div className="shrink-0 px-3 py-2 border-b border-[var(--ink)]/10 flex items-center justify-between gap-2">
            <button
              type="button"
              className="lg:hidden caption text-xs underline"
              onClick={() => setMobilePane("users")}
            >
              ← visitors
            </button>
            <p className="caption text-xs lowercase">
              {userThreads.length} conversation
              {userThreads.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-[var(--ink)]/10">
            {!selectedUserId ? (
              <li className="p-4 caption text-sm">Select a visitor.</li>
            ) : userThreads.length === 0 ? (
              <li className="p-4 caption text-sm">
                No conversations for this visitor.
              </li>
            ) : (
              userThreads.map((t) => {
                const active = t.id === selectedThreadId;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selectThread(t.id)}
                      className={cn(
                        "w-full text-left px-3 py-3 space-y-1 border-l-4 transition-colors",
                        t.escalated
                          ? "border-l-[var(--red)]"
                          : "border-l-transparent",
                        active
                          ? "bg-[var(--cream)]"
                          : "hover:bg-[var(--cream)]/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm line-clamp-1 font-medium">
                          {t.title}
                        </p>
                        <span className="caption text-[0.65rem] shrink-0">
                          {formatWhen(t.latestAt)}
                        </span>
                      </div>
                      <p className="caption text-xs line-clamp-2">{t.preview}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.escalated ? (
                          <span className="sticker sticker-lowercase text-[0.6rem] inline-block bg-[var(--red)]/10 text-[var(--red)]">
                            {conversationStatusLabel(t)}
                            {t.escalationCount > 1
                              ? ` · ${t.escalationCount}×`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Messages — scroll above pinned reply */}
        <section
          className={cn(
            "flex flex-col h-full min-h-0 min-w-0 overflow-hidden",
            mobilePane !== "messages" && "hidden lg:flex",
          )}
        >
          {selectedThread ? (
            <>
              <div className="shrink-0 px-4 py-3 border-b border-[var(--ink)]/10 space-y-2">
                <button
                  type="button"
                  className="lg:hidden caption text-xs underline"
                  onClick={() => setMobilePane("threads")}
                >
                  ← conversations
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-xl font-medium line-clamp-2">
                      {selectedThread.title}
                    </h2>
                    {selectedThread.escalated ? (
                      <div className="space-y-1">
                        <span className="sticker sticker-lowercase text-[0.6rem] inline-block bg-[var(--red)]/10 text-[var(--red)]">
                          {conversationStatusLabel(selectedThread)}
                          {selectedThread.escalationCount > 1
                            ? ` · ${selectedThread.escalationCount}×`
                            : ""}
                        </span>
                        {selectedThread.escalationReasons.length > 0 ? (
                          <ul className="caption text-sm space-y-0.5 max-h-16 overflow-y-auto">
                            {selectedThread.escalationReasons.map(
                              (reason, i) => (
                                <li key={`${i}-${reason.slice(0, 24)}`}>
                                  {reason}
                                </li>
                              ),
                            )}
                          </ul>
                        ) : null}
                        {selectedThread.lastEscalatedAt ? (
                          <p className="caption text-[0.65rem]">
                            last escalated{" "}
                            {formatFullWhen(selectedThread.lastEscalatedAt)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {note ? (
                  <p className="caption text-[0.65rem]">{note}</p>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4">
                {loadingMessages && selectedThread.messages.length === 0 ? (
                  <p className="caption text-sm">Loading messages…</p>
                ) : selectedThread.messages.length === 0 ? (
                  <p className="caption text-sm">No messages yet.</p>
                ) : (
                  selectedThread.messages.map((m) => (
                    <div key={m.id} className="max-w-[42rem] space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[0.6rem] tracking-[0.12em] uppercase opacity-60">
                          {messageAuthor(m)}
                        </span>
                        <span className="caption text-[0.65rem]">
                          {formatFullWhen(m.created_at)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-2 text-sm leading-relaxed border border-[var(--ink)]/15",
                          m.role === "user"
                            ? "bg-white"
                            : m.role === "human"
                              ? "bg-white border-[var(--ink)]/40"
                              : m.role === "assistant"
                                ? "bg-[var(--cream)]"
                                : "bg-transparent border-dashed opacity-80",
                        )}
                      >
                        {m.content}
                      </div>
                      {m.role === "assistant" ? (
                        <MessageCitations citations={m.citations} />
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {selectedThread.escalated ? (
                <div className="shrink-0 border-t border-[var(--ink)]/10 p-3 space-y-2 bg-white">
                  <textarea
                    className="ink-input w-full h-[4.5rem] text-sm resize-none"
                    placeholder="Reply as human — visitor sees this in the widget…"
                    value={reply}
                    disabled={busy}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <p className="caption text-[0.65rem]">
                      ⌘/Ctrl+Enter to send · AI will not reply while escalated
                    </p>
                    <button
                      type="button"
                      className="btn-ink text-xs py-1.5 px-3"
                      disabled={busy || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      send reply
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="caption text-sm text-center max-w-xs">
                Select a visitor and a conversation to read the full thread.
              </p>
            </div>
          )}
        </section>
          </>
        )}
      </div>
    </div>
  );
}
