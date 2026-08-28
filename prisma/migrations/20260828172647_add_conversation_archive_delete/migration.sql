-- Per-user "archive"/"delete" view state for a Conversation -- see the
-- comments on ConversationParticipant.archivedAt/deletedAt in
-- prisma/schema.prisma. Purely additive, nullable columns.
ALTER TABLE "ConversationParticipant" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ConversationParticipant" ADD COLUMN "deletedAt" TIMESTAMP(3);
