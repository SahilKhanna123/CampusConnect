import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  uploadAvatar,
  MAX_AVATAR_BYTES,
  ALLOWED_AVATAR_TYPES,
} from "@/lib/supabase/storage";
import { isLookingForValue } from "@/lib/lookingFor";

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  homeCityId: z.string().min(1),
  major: z.string().trim().max(100).optional(),
  year: z.string().trim().max(50).optional(),
  travelPreferences: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
});

// PATCH /api/profile
// multipart/form-data: name (string), homeCityId (a City id), photo (file,
// optional), plus optional profile-enrichment fields -- major, year,
// travelPreferences, phone (single values), and lookingFor (repeated field,
// zero or more values from LOOKING_FOR_OPTIONS). The single endpoint behind
// three forms: the student onboarding page, step 0 of the parent's
// /family/connect-student wizard, and self-editing on /profile -- the form
// itself (src/components/ProfileEditForm.tsx) decides which of the optional
// fields to show per persona, but this route accepts any of them uniformly
// since they're all optional, private-or-public-as-documented-on-the-schema
// fields on the caller's own row -- there's no security boundary being
// crossed by, say, a student also having a phone field set. Deliberately
// does NOT accept university, badge, or collegeName fields at all:
// verification-derived data is never editable through this route, per
// product decision. onboardingCompletedAt is set here, once, the first time
// this succeeds for a given user.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = fieldsSchema.safeParse({
    name: formData.get("name"),
    homeCityId: formData.get("homeCityId"),
    major: formData.get("major") || undefined,
    year: formData.get("year") || undefined,
    travelPreferences: formData.get("travelPreferences") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your name and pick a home city." },
      { status: 400 },
    );
  }
  const { name, homeCityId, major, year, travelPreferences, phone } =
    parsed.data;

  const lookingFor = formData.getAll("lookingFor").filter(
    (v): v is string => typeof v === "string" && isLookingForValue(v),
  );

  const city = await prisma.city.findUnique({ where: { id: homeCityId } });
  if (!city) {
    return NextResponse.json(
      { error: "That's not a recognized city." },
      { status: 400 },
    );
  }

  let photoUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (
      !ALLOWED_AVATAR_TYPES.includes(
        photo.type as (typeof ALLOWED_AVATAR_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Photo must be a JPEG, PNG, or WebP image." },
        { status: 400 },
      );
    }
    if (photo.size > MAX_AVATAR_BYTES) {
      return NextResponse.json(
        { error: "Photo must be under 5MB." },
        { status: 400 },
      );
    }
    try {
      photoUrl = await uploadAvatar(user.id, photo);
    } catch (err) {
      console.error("Avatar upload failed:", err);
      return NextResponse.json(
        { error: "Couldn't upload the photo. Try again." },
        { status: 502 },
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name,
      homeCityId,
      // The form only ever renders the fields relevant to the caller's
      // persona (see ProfileEditForm's isParent prop), so an absent field
      // here means "doesn't apply to this account" -- explicitly null it
      // out rather than leaving a stale value from before.
      major: major ?? null,
      year: year ?? null,
      travelPreferences: travelPreferences ?? null,
      phone: phone ?? null,
      lookingFor,
      ...(photoUrl ? { photoUrl } : {}),
      ...(user.onboardingCompletedAt
        ? {}
        : { onboardingCompletedAt: new Date() }),
    },
  });

  return NextResponse.json({ ok: true });
}
