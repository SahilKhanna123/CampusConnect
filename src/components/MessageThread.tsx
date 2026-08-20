"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  body: string;
  sentAt: string; // ISO -- always pre-serialized by the caller, see
  // src/app/messages/[id]/page.tsx (a raw Prisma Date can't cross the
  // Server->Client boundary as the same type polling's fetch()/JSON
  // response returns, so both paths are normalized to string here).
  senderId: string;
  sender: { id: string; name: string; photoUrl: string | null };
};

const POLL_INTERVAL_MS = 4000;

// Polls for new messages while the thread is open -- websockets/realtime
// are explicitly deferred for MVP (plan doc §14), this is the chosen
// mechanism. initialMessages comes from the server component's first
// render so the thread isn't empty while the first poll is in flight.
export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestSentAtRef = useRef<string | null>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].sentAt
      : null,
  );
  // Guards against overlapping poll requests -- if a fetch takes longer
  // than POLL_INTERVAL_MS (slow network, a loaded Supabase pooler, etc.),
  // the next interval tick would otherwise fire a second GET before the
  // first one's response updates latestSentAtRef, so both requests use the
  // same stale `since` and both come back with the same not-yet-seen
  // message -- this is what caused the "same message appears 2-3x" bug.
  const pollInFlightRef = useRef(false);

  // Appends any messages from `incoming` not already present in state,
  // keyed by id -- the one merge point both the poller and handleSend's own
  // optimistic append go through, so a message can never end up duplicated
  // in the thread no matter how the two race against each other.
  function appendNewMessages(incoming: Message[]) {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
  }

  // Marks the thread read the moment it's opened, so the unread bold/badge
  // treatment on /messages and the nav "Messages" item clears -- fire and
  // forget, nothing in the UI depends on this succeeding immediately.
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
  }, [conversationId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const url = new URL(
          `/api/conversations/${conversationId}/messages`,
          window.location.origin,
        );
        if (latestSentAtRef.current) {
          url.searchParams.set("since", latestSentAtRef.current);
        }
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const body = await res.json();
        if (body.messages?.length > 0) {
          appendNewMessages(body.messages);
          latestSentAtRef.current = body.messages[body.messages.length - 1].sentAt;
          // New messages arrived while the thread was already open -- keep
          // lastReadAt current so they don't show as unread the moment the
          // user navigates away.
          fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
        }
      } finally {
        pollInFlightRef.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [conversationId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setError(null);
    setSending(true);

    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setSending(false);
      return;
    }

    const body = await res.json();
    appendNewMessages([body.message]);
    latestSentAtRef.current = body.message.sentAt;
    setDraft("");
    setSending(false);
  }

  return (
    <div>
      <ul className="message-thread">
        {messages.map((m) => (
          <li
            key={m.id}
            className={
              m.senderId === currentUserId
                ? "message-bubble message-bubble-self"
                : "message-bubble"
            }
          >
            <div className="message-body">{m.body}</div>
            <div className="message-meta">
              {m.senderId === currentUserId ? "You" : m.sender.name} ·{" "}
              {new Date(m.sentAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSend} className="message-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
