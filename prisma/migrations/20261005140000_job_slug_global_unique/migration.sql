-- DropIndex
DROP INDEX "public"."job_posts_company_id_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_slug_key" ON "public"."job_posts"("slug");

