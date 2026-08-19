import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Messages — conversation list, scoped to (trip, counterpart) pairs. Each
// row links to /messages/[id], which polls for new messages while open
// (see plan doc §14 — polling, not websockets).
export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      participants: {
        where: { userId: { not: user.id } },
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Messages</h1>
      {conversations.length === 0 ? (
        <p>Your conversations will appear here.</p>
      ) : (
        <ul>
          {conversations.map((c) => {
            const counterpart = c.participants[0]?.user;
            const lastMessage = c.messages[0];
            const destinationLabel =
              c.trip.destinationCity?.name ?? c.trip.destinationText ?? "?";
            return (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`}>
                  {counterpart?.name ?? "Unknown"} — {c.trip.originCity.name} →{" "}
                  {destinationLabel}
                  {lastMessage && <>: {lastMessage.body}</>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
