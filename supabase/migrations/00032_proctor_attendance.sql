-- ============================================================
-- PROCTOR ROLE (must be its own migration so the new enum value
-- is committed before it can be referenced in 00033).
-- ============================================================
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'proctor';
