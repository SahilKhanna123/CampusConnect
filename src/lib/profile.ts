import { prisma } from "@/lib/prisma";

/**
 * Public-safe view of a user's profile -- a hand-picked Prisma `select`,
 * deliberately never `include`, so a new relation added to User later can't
 * silently leak into this response. Excludes email, phone, StudentRecord
 * contents, ParentStudentLink rows, signedUpAsParent, and
 * VerificationRecord's verifiedValue/metadata/token beyond the one field
 * (university name) this view is allowed to surface. major/year/
 * travelPreferences/lookingFor/linkedStudentName are public by product
 * decision (part of the profile a rider/driver would want to see), while
 * phone stays private, same tier as email. linkedStudentName is
 * self-declared by the parent (not derived from StudentRecord.fullName,
 * which stays private) and is cleared server-side the moment the parent's
 * last non-revoked ParentStudentLink is removed -- see
 * src/app/api/family/link-objection/[token]/reject/route.ts -- so it can
 * only ever show a student's name while a live, unobjected-to connection
 * backs it. Used by both GET /api/profile/[userId] and the public
 * /profile/[userId] page so there's exactly one allowlist to keep in sync,
 * not two.
 */
export async function getPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      major: true,
      year: true,
      travelPreferences: true,
      lookingFor: true,
      linkedStudentName: true,
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
    major: user.major,
    year: user.year,
    travelPreferences: user.travelPreferences,
    lookingFor: user.lookingFor,
    linkedStudentName: user.linkedStudentName,
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
