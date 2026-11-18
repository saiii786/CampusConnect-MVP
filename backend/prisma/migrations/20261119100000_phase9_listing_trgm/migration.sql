-- Phase 9 (additive): trigram indexes for listing text search (ADR-027).
-- pg_trgm ships with PostgreSQL and is available on Supabase (free tier).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Listing_description_trgm_idx" ON "Listing" USING GIN ("description" gin_trgm_ops);
