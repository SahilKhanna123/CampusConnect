import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  uploadAvatar,
  MAX_AVATAR_BYTES,
  ALLOWED_AVATAR_TYPES,
} from "@/lib/supabase/storage";

const fieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  homeCityId: z.string().min(1),
});

// PATCH /api/profile
// multipart/form-data: name (string), homeCityId (a City id), photo (file,
// optional). The single endpoint behind three forms: the student onboarding
// page, step 0 of the parent's /family/connect-student wizard, and
// self-editing on /profile -- all three collect the same name/photo/home-area
// fields. Deliberately does NOT accept university, badge, or collegeName
// fields at all: verification-derived data is never editable through this
// route, per product decision. onboardingCompletedAt is set here, once, the
// first time this succeeds for a given user.
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const parsed = fieldsSchema.safeParse({
    name: formData.get("name"),
    homeCityId: formData.get("homeCityId"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter your name and pick a home city." },
      { status: 400 },
    );
  }
  const { name, homeCityId } = parsed.data;

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
      ...(photoUrl ? { photoUrl } : {}),
      ...(user.onboardingCompletedAt
        ? {}
        : { onboardingCompletedAt: new Date() }),
    },
  });

  return NextResponse.json({ ok: true });
}
