GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT INSERT ON public.partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;