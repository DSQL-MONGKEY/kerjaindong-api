-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('JOB_SEEKER', 'EMPLOYER', 'SYS_ADMIN');

-- CreateEnum
CREATE TYPE "public"."CompanyMemberRole" AS ENUM ('OWNER', 'ADMIN', 'RECRUITER');

-- CreateEnum
CREATE TYPE "public"."VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."RegionLevel" AS ENUM ('PROVINCE', 'REGENCY', 'DISTRICT', 'VILLAGE');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE');

-- CreateEnum
CREATE TYPE "public"."WorkMode" AS ENUM ('ONSITE', 'REMOTE', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."ExperienceLevel" AS ENUM ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "public"."SalaryPeriod" AS ENUM ('HOURLY', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "public"."ApplicationStatus" AS ENUM ('APPLIED', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'ACCEPTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "clerk_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150),
    "avatar_key" VARCHAR(512),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_roles" (
    "user_id" UUID NOT NULL,
    "role" "public"."Role" NOT NULL,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "public"."job_seeker_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "headline" VARCHAR(255),
    "summary" TEXT,
    "phone" VARCHAR(30),
    "photo_key" VARCHAR(512),
    "province_id" UUID,
    "city_id" UUID,
    "expected_salary" INTEGER,
    "salary_currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "open_to_work" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_seeker_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resumes" (
    "id" UUID NOT NULL,
    "job_seeker_id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "file_key" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "logo_key" VARCHAR(512),
    "banner_key" VARCHAR(512),
    "website" VARCHAR(255),
    "industry" VARCHAR(100),
    "description" TEXT,
    "province_id" UUID,
    "city_id" UUID,
    "verification" "public"."VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."employer_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100),
    "position" VARCHAR(100),
    "company_role" "public"."CompanyMemberRole" NOT NULL DEFAULT 'RECRUITER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."company_invitations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "public"."CompanyMemberRole" NOT NULL DEFAULT 'RECRUITER',
    "token_hash" VARCHAR(255) NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."regions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "level" "public"."RegionLevel" NOT NULL,
    "parent_id" UUID,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_posts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "benefits" TEXT,
    "employment_type" "public"."EmploymentType" NOT NULL,
    "work_mode" "public"."WorkMode" NOT NULL DEFAULT 'ONSITE',
    "experience_level" "public"."ExperienceLevel",
    "province_id" UUID,
    "city_id" UUID,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "salary_period" "public"."SalaryPeriod" NOT NULL DEFAULT 'MONTHLY',
    "status" "public"."JobStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "application_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_applications" (
    "id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "job_seeker_id" UUID NOT NULL,
    "resume_id" UUID,
    "status" "public"."ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "resume_snapshot" JSONB,
    "cover_letter" TEXT,
    "viewed_at" TIMESTAMPTZ(3),
    "status_changed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."application_status_history" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "from_status" "public"."ApplicationStatus",
    "to_status" "public"."ApplicationStatus" NOT NULL,
    "changed_by_id" UUID,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_jobs" (
    "job_seeker_id" UUID NOT NULL,
    "job_post_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_jobs_pkey" PRIMARY KEY ("job_seeker_id","job_post_id")
);

-- CreateTable
CREATE TABLE "public"."company_follows" (
    "job_seeker_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_follows_pkey" PRIMARY KEY ("job_seeker_id","company_id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "public"."users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "public"."user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "job_seeker_profiles_user_id_key" ON "public"."job_seeker_profiles"("user_id");

-- CreateIndex
CREATE INDEX "job_seeker_profiles_city_id_idx" ON "public"."job_seeker_profiles"("city_id");

-- CreateIndex
CREATE INDEX "job_seeker_profiles_open_to_work_idx" ON "public"."job_seeker_profiles"("open_to_work");

-- CreateIndex
CREATE INDEX "resumes_job_seeker_id_is_primary_idx" ON "public"."resumes"("job_seeker_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "public"."companies"("slug");

-- CreateIndex
CREATE INDEX "companies_city_id_idx" ON "public"."companies"("city_id");

-- CreateIndex
CREATE INDEX "companies_verification_idx" ON "public"."companies"("verification");

-- CreateIndex
CREATE UNIQUE INDEX "employer_profiles_user_id_key" ON "public"."employer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "employer_profiles_company_id_company_role_idx" ON "public"."employer_profiles"("company_id", "company_role");

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "public"."company_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "company_invitations_company_id_idx" ON "public"."company_invitations"("company_id");

-- CreateIndex
CREATE INDEX "company_invitations_email_idx" ON "public"."company_invitations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "regions_code_key" ON "public"."regions"("code");

-- CreateIndex
CREATE INDEX "regions_level_parent_id_idx" ON "public"."regions"("level", "parent_id");

-- CreateIndex
CREATE INDEX "regions_name_idx" ON "public"."regions"("name");

-- CreateIndex
CREATE INDEX "job_posts_status_published_at_idx" ON "public"."job_posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "job_posts_company_id_status_idx" ON "public"."job_posts"("company_id", "status");

-- CreateIndex
CREATE INDEX "job_posts_status_city_id_idx" ON "public"."job_posts"("status", "city_id");

-- CreateIndex
CREATE INDEX "job_posts_status_employment_type_idx" ON "public"."job_posts"("status", "employment_type");

-- CreateIndex
CREATE UNIQUE INDEX "job_posts_company_id_slug_key" ON "public"."job_posts"("company_id", "slug");

-- CreateIndex
CREATE INDEX "job_applications_job_post_id_status_idx" ON "public"."job_applications"("job_post_id", "status");

-- CreateIndex
CREATE INDEX "job_applications_job_seeker_id_status_created_at_idx" ON "public"."job_applications"("job_seeker_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_job_post_id_job_seeker_id_key" ON "public"."job_applications"("job_post_id", "job_seeker_id");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_created_at_idx" ON "public"."application_status_history"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "saved_jobs_job_post_id_idx" ON "public"."saved_jobs"("job_post_id");

-- CreateIndex
CREATE INDEX "company_follows_company_id_idx" ON "public"."company_follows"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "public"."audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "public"."audit_logs"("actor_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_seeker_profiles" ADD CONSTRAINT "job_seeker_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resumes" ADD CONSTRAINT "resumes_job_seeker_id_fkey" FOREIGN KEY ("job_seeker_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_profiles" ADD CONSTRAINT "employer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."employer_profiles" ADD CONSTRAINT "employer_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_invitations" ADD CONSTRAINT "company_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regions" ADD CONSTRAINT "regions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_posts" ADD CONSTRAINT "job_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_job_seeker_id_fkey" FOREIGN KEY ("job_seeker_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."job_applications" ADD CONSTRAINT "job_applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."application_status_history" ADD CONSTRAINT "application_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_jobs" ADD CONSTRAINT "saved_jobs_job_seeker_id_fkey" FOREIGN KEY ("job_seeker_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_jobs" ADD CONSTRAINT "saved_jobs_job_post_id_fkey" FOREIGN KEY ("job_post_id") REFERENCES "public"."job_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_follows" ADD CONSTRAINT "company_follows_job_seeker_id_fkey" FOREIGN KEY ("job_seeker_id") REFERENCES "public"."job_seeker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."company_follows" ADD CONSTRAINT "company_follows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
