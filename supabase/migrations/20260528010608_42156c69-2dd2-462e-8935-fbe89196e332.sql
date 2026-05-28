
-- 1) Restrict public read of properties to active only
DROP POLICY IF EXISTS "public read active properties" ON public.properties;
CREATE POLICY "public read active properties"
ON public.properties
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- 2) Lock down sensitive partner columns from self-update via trigger
CREATE OR REPLACE FUNCTION public.prevent_partner_sensitive_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.fee_agreement_type IS DISTINCT FROM OLD.fee_agreement_type
     OR NEW.fee_rate IS DISTINCT FROM OLD.fee_rate
     OR NEW.bank_details IS DISTINCT FROM OLD.bank_details
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not authorized to modify protected partner fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partners_prevent_sensitive_update ON public.partners;
CREATE TRIGGER partners_prevent_sensitive_update
BEFORE UPDATE ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.prevent_partner_sensitive_update();
