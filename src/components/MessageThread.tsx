"use client";

import { useEffect, useRef, useState } from "react";
import { SeatOfferBubble, type SeatOfferData } from "@/components/SeatOfferBubble";

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

// 8s, not 4s -- halves the request volume (and the middleware session-check
// + DB round trip that rides along with every request) for a chat that
// doesn't need sub-4-second latency. Combined with the visibility check
// below (skip entirely while the tab is backgrounded), this meaningfully
// cuts the sustained request rate an open-but-idle thread generates -- see
// the Supabase Disk IO budget discussion this was added for.
const POLL_INTERVAL_MS = 8000;

// Polls for new messages while the thread is open -- websockets/realtime
// are explicitly deferred for MVP (plan doc §14), this is the chosen
// mechanism. initialMessages comes from the server component's first
// render so the thread isn't empty while the first poll is in flight.
//
// SeatOffers (see the Seat Offers section of CLAUDE.md) render as inline
// bubbles in this same thread, sorted chronologically alongside real
// messages -- the trip owner's "Send Seat Request" action and both
// parties' Accept/Decline/Cancel/Remove actions all live here rather than
// as separate controls above the thread, and the same poll loop that
// fetches new messages also refreshes seat offer status, so an offer
// accepted/declined by the other party shows up live for both sides.
export function MessageThread({
  conversationId,
  currentUserId,
  isOwner,
  counterpartId,
  seatsAvailable,
  initialMessages,
  initialSeatOffers,
}: {
  conversationId: string;
  currentUserId: string;
  isOwner: boolean;
  counterpartId: string;
  seatsAvailable: boolean;
  initialMessages: Message[];
  initialSeatOffers: SeatOfferData[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [seatOffers, setSeatOffers] = useState<SeatOfferData[]>(initialSeatOffers);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
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

  function updateSeatOffer(patch: Partial<SeatOfferData> & { id: string }) {
    setSeatOffers((prev) => prev.map((o) => (o.id === patch.id ? { ...o, ...patch } : o)));
  }

  // Marks the thread read the moment it's opened, so the unread bold/badge
  // treatment on /messages and the nav "Messages" item clears -- fire and
  // forget, nothing in the UI depends on this succeeding immediately.
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
  }, [conversationId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip the tick entirely while the tab is backgrounded -- there's no
      // one looking at the thread, so there's no reason to keep hitting the
      // API (and the middleware auth check + DB round trip riding along
      // with it) every POLL_INTERVAL_MS regardless. Resumes on its own the
      // next tick after the tab becomes visible again -- no separate
      // visibilitychange listener needed since this check already runs
      // every interval tick.
      if (document.visibilityState !== "visible") return;
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
        // Always synced, independent of whether new messages arrived --
        // the other party accepting/declining a seat offer is itself an
        // event this thread needs to reflect live, with no new Message
        // necessarily attached to it.
        if (body.seatOffers) {
          setSeatOffers(body.seatOffers);
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

  async function handleSendSeatOffer() {
    setOfferError(null);
    setSendingOffer(true);

    const res = await fetch("/api/seat-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setOfferError(body.error ?? "Something went wrong. Try again.");
      setSendingOffer(false);
      return;
    }

    const body = await res.json();
    setSeatOffers((prev) => [
      ...prev,
      {
        id: body.seatOfferId,
        status: "pending",
        recipientId: counterpartId,
        createdAt: new Date().toISOString(),
        respondedAt: null,
        seatConfirmedAt: null,
      },
    ]);
    setSendingOffer(false);
  }

  // Only sendable when there's no currently pending/accepted offer already
  // -- the bubble for that existing offer already carries Cancel/Remove,
  // so a second top-level control would be redundant. Mirrors
  // POST /api/seat-offers' own duplicate-pending rejection.
  const latestOffer = seatOffers[seatOffers.length - 1];
  const canSendNewOffer =
    isOwner && (!latestOffer || latestOffer.status === "declined" || latestOffer.status === "cancelled");

  type ThreadItem =
    | { kind: "message"; sortKey: string; message: Message }
    | { kind: "seatOffer"; sortKey: string; offer: SeatOfferData };

  const items: ThreadItem[] = [
    ...messages.map((m): ThreadItem => ({ kind: "message", sortKey: m.sentAt, message: m })),
    ...seatOffers.map((o): ThreadItem => ({ kind: "seatOffer", sortKey: o.createdAt, offer: o })),
  ].sort((a, b) => new Date(a.sortKey).getTime() - new Date(b.sortKey).getTime());

  return (
    <div className="chat-panel">
      <ul className="message-thread">
        {items.map((item) => {
          if (item.kind === "seatOffer") {
            return (
              <SeatOfferBubble
                key={`seat-offer-${item.offer.id}`}
                offer={item.offer}
                currentUserId={currentUserId}
                isOwner={isOwner}
                onUpdate={updateSeatOffer}
              />
            );
          }
          const isSelf = item.message.senderId === currentUserId;
          return (
            <li
              key={`message-${item.message.id}`}
              className={isSelf ? "message-row message-row-self" : "message-row"}
            >
              {!isSelf &&
                (item.message.sender.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.message.sender.photoUrl}
                    alt=""
                    className="avatar-circle message-row-avatar"
                  />
                ) : (
                  <span className="avatar-circle message-row-avatar" aria-hidden="true">
                    {item.message.sender.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              <div className={isSelf ? "message-bubble message-bubble-self" : "message-bubble"}>
                <div className="message-body">{item.message.body}</div>
                <div className="message-meta">
                  {new Date(item.message.sentAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner && canSendNewOffer && (
        <div className="seat-offer-send-row">
          <button
            type="button"
            onClick={handleSendSeatOffer}
            disabled={sendingOffer || !seatsAvailable}
            className="btn-secondary"
          >
            {sendingOffer ? "Sending…" : "Send Seat Request"}
          </button>
          {!seatsAvailable && (
            <span className="seat-confirmed-badge-none">No seats remaining</span>
          )}
          {offerError && <p role="alert">{offerError}</p>}
        </div>
      )}

      <form onSubmit={handleSend} className="message-compose">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          maxLength={2000}
          rows={1}
        />
        <button type="submit" disabled={sending || !draft.trim()} className="btn-primary">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && (
        <p role="alert" className="message-compose-error">
          {error}
        </p>
      )}
    </div>
  );
}
