-- Seed the app_settings table with the simulated_time key.
-- Value is JSON null when inactive, or a JSON string like "2026-05-01T10:30:00" when active.
INSERT INTO public.app_settings (key, value)
VALUES ('simulated_time', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
