import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lists the current user's own Trip (offer) and Request (need) posts --
// travelerId / postedById are the ownership fields the API routes enforce
// too (see src/app/api/{trips,requests}/[id]/route.ts). Cancelled posts
// stay visible here with a status label rather than disappearing, same as
// how a revoked ParentStudentLink still shows on /profile.
export default async function MyPostsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [trips, requests] = await Promise.all([
    prisma.trip.findMany({
      where: { travelerId: user.id },
      include: { originCity: true, destinationCity: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.request.findMany({
      where: { postedById: user.id },
      include: { originCity: true, destinationCity: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <h1>My Posts</h1>
      <p>
        <Link href="/post">Create a new post</Link>
      </p>

      <h2>Trips You&apos;re Offering</h2>
      {trips.length === 0 ? (
        <p>No trips posted yet.</p>
      ) : (
        <ul>
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`}>
                {trip.originCity.name} → {trip.destinationCity.name} —{" "}
                {trip.departureDate.toLocaleDateString()}
              </Link>
              {" "}({trip.status})
            </li>
          ))}
        </ul>
      )}

      <h2>Your Requests</h2>
      {requests.length === 0 ? (
        <p>No requests posted yet.</p>
      ) : (
        <ul>
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`}>
                {r.type === "ride" ? "Ride" : "Delivery"}:{" "}
                {r.originCity?.name ?? "?"} → {r.destinationCity?.name ?? "?"}
                {r.neededDate && ` — ${r.neededDate.toLocaleDateString()}`}
              </Link>
              {" "}({r.status})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
