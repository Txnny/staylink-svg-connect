
DROP POLICY "public onboarding insert" ON public.partners;
CREATE POLICY "public onboarding insert" ON public.partners
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'onboarding' AND user_id IS NULL);

DROP POLICY "public submit traveller" ON public.travellers;
CREATE POLICY "public submit traveller" ON public.travellers
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(full_name) > 0 AND length(email) > 0);
