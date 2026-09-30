-- ============================================================
-- Team Leave Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables.
-- ============================================================

-- 1. profiles
CREATE TABLE IF NOT EXISTS profiles (
    id          BIGSERIAL PRIMARY KEY,
    full_name   TEXT        NOT NULL,
    email       TEXT        UNIQUE,
    department  TEXT,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. leave_types
CREATE TABLE IF NOT EXISTS leave_types (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    description TEXT,
    color       TEXT        NOT NULL DEFAULT '#3b82f6',
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. public_holidays
CREATE TABLE IF NOT EXISTS public_holidays (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    date        DATE        NOT NULL,
    year        INTEGER     GENERATED ALWAYS AS (EXTRACT(YEAR FROM date)::INTEGER) STORED,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. leave_records
CREATE TABLE IF NOT EXISTS leave_records (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     BIGINT      NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    leave_type_id   BIGINT      NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    start_date      DATE        NOT NULL,
    end_date        DATE        NOT NULL,
    number_of_days  NUMERIC(5,1) NOT NULL DEFAULT 0,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_dates CHECK (end_date >= start_date)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_leave_records_employee   ON leave_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_start_date ON leave_records(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_records_end_date   ON leave_records(end_date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_date     ON public_holidays(date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_year     ON public_holidays(year);

-- ============================================================
-- Enable Row-Level Security but allow ALL access (no auth)
-- The anon key has full read/write — no login required.
-- ============================================================
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

-- Allow full access via the anon role (no authentication required)
CREATE POLICY "anon_all_profiles"        ON profiles        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_leave_types"     ON leave_types     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_leave_records"   ON leave_records   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_public_holidays" ON public_holidays FOR ALL TO anon USING (true) WITH CHECK (true);

-- Also allow authenticated role (in case the project has auth enabled later)
CREATE POLICY "auth_all_profiles"        ON profiles        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_leave_types"     ON leave_types     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_leave_records"   ON leave_records   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_public_holidays" ON public_holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);
