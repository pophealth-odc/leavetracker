-- ============================================================
-- Team Leave Tracker — Seed Data
-- Run AFTER schema.sql.  Safe to re-run (uses ON CONFLICT DO NOTHING).
-- ============================================================

-- Leave Types
INSERT INTO leave_types (name, description, color, is_active) VALUES
  ('Annual Leave',    'Annual vacation leave',          '#3b82f6', TRUE),
  ('Sick Leave',      'Medical / health-related leave', '#ef4444', TRUE),
  ('Emergency Leave', 'Unplanned urgent leave',         '#f97316', TRUE),
  ('Unpaid Leave',    'Leave without pay',              '#6b7280', TRUE),
  ('Other',           'Other types of leave',           '#8b5cf6', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Team Members (profiles)
INSERT INTO profiles (full_name, email, department, is_active) VALUES
  ('John Smith',   'john.smith@example.com',   'Development', TRUE),
  ('Sarah Lee',    'sarah.lee@example.com',    'QA',          TRUE),
  ('Mike Tan',     'mike.tan@example.com',     'Development', TRUE),
  ('Lisa Wong',    'lisa.wong@example.com',    'HR',          TRUE),
  ('David Chen',   'david.chen@example.com',   'Design',      TRUE),
  ('Emily Lim',    'emily.lim@example.com',    'QA',          TRUE),
  ('James Ng',     'james.ng@example.com',     'Development', TRUE),
  ('Rachel Koh',   'rachel.koh@example.com',   'HR',          TRUE)
ON CONFLICT (email) DO NOTHING;

-- Public Holidays (2025 & 2026 — adjust years/dates to match your locale)
INSERT INTO public_holidays (name, date) VALUES
  -- 2025
  ('New Year''s Day',    '2025-01-01'),
  ('Chinese New Year',   '2025-01-29'),
  ('Chinese New Year',   '2025-01-30'),
  ('Good Friday',        '2025-04-18'),
  ('Labour Day',         '2025-05-01'),
  ('Vesak Day',          '2025-05-12'),
  ('Hari Raya Haji',     '2025-06-06'),
  ('National Day',       '2025-08-09'),
  ('Deepavali',          '2025-10-20'),
  ('Christmas Day',      '2025-12-25'),
  -- 2026
  ('New Year''s Day',    '2026-01-01'),
  ('Chinese New Year',   '2026-02-17'),
  ('Chinese New Year',   '2026-02-18'),
  ('Good Friday',        '2026-04-03'),
  ('Labour Day',         '2026-05-01'),
  ('Vesak Day',          '2026-05-31'),
  ('Hari Raya Haji',     '2026-05-27'),
  ('National Day',       '2026-08-09'),
  ('Deepavali',          '2026-11-08'),
  ('Christmas Day',      '2026-12-25')
ON CONFLICT DO NOTHING;

-- Sample Leave Records  (IDs reference the inserted rows above — adjust if auto-increments differ)
-- We use sub-selects so the seed is resilient to ID values.
INSERT INTO leave_records (employee_id, leave_type_id, start_date, end_date, number_of_days, reason)
SELECT
  (SELECT id FROM profiles    WHERE email = 'john.smith@example.com'),
  (SELECT id FROM leave_types WHERE name  = 'Annual Leave'),
  '2026-10-05', '2026-10-09', 5, 'Family vacation'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'john.smith@example.com');

INSERT INTO leave_records (employee_id, leave_type_id, start_date, end_date, number_of_days, reason)
SELECT
  (SELECT id FROM profiles    WHERE email = 'sarah.lee@example.com'),
  (SELECT id FROM leave_types WHERE name  = 'Sick Leave'),
  '2026-10-12', '2026-10-13', 2, 'Flu'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'sarah.lee@example.com');

INSERT INTO leave_records (employee_id, leave_type_id, start_date, end_date, number_of_days, reason)
SELECT
  (SELECT id FROM profiles    WHERE email = 'mike.tan@example.com'),
  (SELECT id FROM leave_types WHERE name  = 'Annual Leave'),
  '2026-11-03', '2026-11-04', 2, 'Rest day'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'mike.tan@example.com');

INSERT INTO leave_records (employee_id, leave_type_id, start_date, end_date, number_of_days, reason)
SELECT
  (SELECT id FROM profiles    WHERE email = 'lisa.wong@example.com'),
  (SELECT id FROM leave_types WHERE name  = 'Emergency Leave'),
  '2026-09-22', '2026-09-23', 2, 'Family emergency'
WHERE EXISTS (SELECT 1 FROM profiles WHERE email = 'lisa.wong@example.com');
