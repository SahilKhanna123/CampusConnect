-- Per-post "visible to students only" flag on Trip and Request -- see the
-- comment on Request.studentsOnly in prisma/schema.prisma. Purely additive,
-- non-null with a default so every existing row stays publicly visible.
ALTER TABLE "Trip" ADD COLUMN "studentsOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Request" ADD COLUMN "studentsOnly" BOOLEAN NOT NULL DEFAULT false;
