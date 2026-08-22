import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PosterBadge } from "@/components/ExploreCard";
import { RespondToConnectionRequestButtons } from "@/components/RespondToConnectionRequestButtons";
import { CancelConnectionRequestButton } from "@/components/CancelConnectionRequestButton";

const POSTER_SELECT = {
  id: true,
  name: true,
  photoUrl: true,
  signedUpAsParent: true,
  verifications: {
    where: { status: "verified" as const },
    select: { type: true, status: true },
  },
};

// Connection Requests — Received (default) and Sent, mirroring the
// Upcoming/History tab convention on /my-posts (plain ?tab= query param,
// server-rendered, no client JS for the tab switch itself). Received rows
// show the requester via PosterBadge (name, photo, Student/Parent status --
// the same visual block Explore cards use) plus the trip and current
// status; pending rows get Accept/Decline. Sent rows show the recipient,
// trip, date, and status; pending rows get Cancel.
export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "sent" ? "sent" : "received";

  const received =
    activeTab === "received"
      ? await prisma.connectionRequest.findMany({
          where: { recipientId: user.id },
          include: {
            trip: { include: { originCity: true, destinationCity: true } },
            requester: { select: POSTER_SELECT },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const sent =
    activeTab === "sent"
      ? await prisma.connectionRequest.findMany({
          where: { requesterId: user.id },
          include: {
            trip: { include: { originCity: true, destinationCity: true } },
            recipient: { select: POSTER_SELECT },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <div>
      <h1>Connection Requests</h1>

      <nav aria-label="Connection requests view">
        <Link
          href="/connections"
          aria-current={activeTab === "received" ? "page" : undefined}
          style={{ fontWeight: activeTab === "received" ? "bold" : "normal" }}
        >
          Received
        </Link>
        {" | "}
        <Link
          href="/connections?tab=sent"
          aria-current={activeTab === "sent" ? "page" : undefined}
          style={{ fontWeight: activeTab === "sent" ? "bold" : "normal" }}
        >
          Sent
        </Link>
      </nav>

      {activeTab === "received" ? (
        received.length === 0 ? (
          <p>No connection requests received yet.</p>
        ) : (
          <div className="connection-list">
            {received.map((r) => {
              const destinationLabel =
                r.trip.destinationCity?.name ?? r.trip.destinationText ?? "?";
              return (
                <div key={r.id} className="connection-item">
                  <PosterBadge poster={r.requester} />
                  <div className="connection-item-trip">
                    <Link href={`/trips/${r.tripId}`}>
                      {r.trip.title || "Untitled trip"}: {r.trip.originCity.name} →{" "}
                      {destinationLabel}
                    </Link>
                  </div>
                  <div className="connection-item-meta">
                    Requested {r.createdAt.toLocaleDateString()} ·{" "}
                    <span className={`connection-status-label connection-status-label-${r.status}`}>
                      {r.status}
                    </span>
                  </div>
                  {r.message && <p className="connection-item-message">&ldquo;{r.message}&rdquo;</p>}
                  {r.status === "pending" && (
                    <RespondToConnectionRequestButtons connectionRequestId={r.id} />
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : sent.length === 0 ? (
        <p>No connection requests sent yet.</p>
      ) : (
        <div className="connection-list">
          {sent.map((r) => {
            const destinationLabel =
              r.trip.destinationCity?.name ?? r.trip.destinationText ?? "?";
            return (
              <div key={r.id} className="connection-item">
                <PosterBadge poster={r.recipient} />
                <div className="connection-item-trip">
                  <Link href={`/trips/${r.tripId}`}>
                    {r.trip.title || "Untitled trip"}: {r.trip.originCity.name} →{" "}
                    {destinationLabel}
                  </Link>
                </div>
                <div className="connection-item-meta">
                  Requested {r.createdAt.toLocaleDateString()} ·{" "}
                  <span className={`connection-status-label connection-status-label-${r.status}`}>
                    {r.status}
                  </span>
                </div>
                {r.message && <p className="connection-item-message">&ldquo;{r.message}&rdquo;</p>}
                {r.status === "pending" && (
                  <CancelConnectionRequestButton connectionRequestId={r.id} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
