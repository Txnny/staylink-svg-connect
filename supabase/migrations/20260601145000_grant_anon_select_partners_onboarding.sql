-- Partner onboarding uses insert(...).select('id').single() as anon.
-- 20260601102619 revoked ALL from anon and only granted INSERT; restore SELECT
-- so PostgREST can return the new row id without widening RLS (policies unchanged).
GRANT SELECT ON public.partners TO anon;
