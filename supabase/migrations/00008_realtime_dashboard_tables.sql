-- Add tables to realtime publication for live admin dashboard stats
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personal_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
