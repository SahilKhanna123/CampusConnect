import { createAdminClient } from "@/lib/supabase/admin";

// Public bucket -- profile photos are, by design, one of the public profile
// fields (see the Public vs private split in the profile plan), so a public
// read URL is appropriate; only the owner can write, since every upload
// goes through the server-side PATCH /api/profile route after
// getCurrentUser() has authenticated the caller. Create/configure this
// bucket via `npm run supabase:setup-storage` (scripts/setup-storage.ts) --
// it doesn't exist by default on a fresh Supabase project.
export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const ALLOWED_AVATAR_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads a profile photo under a per-user path (avatars/{userId}/...) and
 * returns its public URL. Always called server-side, after the caller has
 * already been authenticated and the file type/size validated -- this
 * function itself does no auth or validation, it just uploads.
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const admin = createAdminClient();
  const extension = EXTENSION_BY_TYPE[file.type] ?? "jpg";
  const path = `${userId}/${Date.now()}.${extension}`;

  const { error } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
