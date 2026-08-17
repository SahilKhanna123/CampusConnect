// One-time (idempotent) setup: creates the Supabase Storage bucket profile
// photo uploads need. Unlike prisma/seed.ts, this doesn't run automatically
// -- run it once per environment via `npm run supabase:setup-storage`.
import { createAdminClient } from "../src/lib/supabase/admin";
import {
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  ALLOWED_AVATAR_TYPES,
} from "../src/lib/supabase/storage";

async function main() {
  const admin = createAdminClient();

  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;

  if (buckets?.some((bucket) => bucket.name === AVATAR_BUCKET)) {
    console.log(`"${AVATAR_BUCKET}" bucket already exists -- nothing to do.`);
    return;
  }

  const { error: createError } = await admin.storage.createBucket(
    AVATAR_BUCKET,
    {
      public: true,
      fileSizeLimit: MAX_AVATAR_BYTES,
      allowedMimeTypes: [...ALLOWED_AVATAR_TYPES],
    },
  );
  if (createError) throw createError;

  console.log(`Created "${AVATAR_BUCKET}" bucket (public, ${MAX_AVATAR_BYTES} byte limit).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
