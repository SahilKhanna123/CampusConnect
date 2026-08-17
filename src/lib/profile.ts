import { prisma } from "@/lib/prisma";

/**
 * Public-safe view of a user's profile -- a hand-picked Prisma `select`,
 * deliberately never `include`, so a new relation added to User later can't
 * silently leak into this response. Excludes email, StudentRecord contents,
 * ParentStudentLink rows, signedUpAsParent, and VerificationRecord's
 * verifiedValue/metadata/token beyond the one field (university name) this
 * view is allowed to surface. Used by both GET /api/profile/[userId] and
 * the public /profile/[userId] page so there's exactly one allowlist to
 * keep in sync, not two.
 */
export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      homeCity: {
        select: { name: true, region: { select: { name: true } } },
      },
      verifications: {
        where: { status: "verified" },
        select: { type: true, metadata: true },
      },
    },
  });
  if (!user) return null;

  const universityRecord = user.verifications.find(
    (v) => v.type === "university",
  );
  const universityName =
    (universityRecord?.metadata as { university?: string } | null)
      ?.university ?? null;

  const verifiedTypes = new Set(user.verifications.map((v) => v.type));

  return {
    id: user.id,
    name: user.name,
    photoUrl: user.photoUrl,
    homeArea: user.homeCity
      ? `${user.homeCity.name}, ${user.homeCity.region.name}`
      : null,
    university: universityName,
    badges: {
      email: verifiedTypes.has("email"),
      university: verifiedTypes.has("university"),
      parentRelationship: verifiedTypes.has("parent_relationship"),
      identity: verifiedTypes.has("identity"),
    },
  };
}

export type PublicProfile = NonNullable<
  Awaited<ReturnType<typeof getPublicProfile>>
>;
