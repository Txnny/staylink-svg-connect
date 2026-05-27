
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'partner');
CREATE TYPE public.property_type AS ENUM ('hotel', 'airbnb', 'guesthouse', 'hostel', 'villa');
CREATE TYPE public.property_status AS ENUM ('active', 'inactive', 'onboarding');
CREATE TYPE public.partner_status AS ENUM ('active', 'inactive', 'onboarding');
CREATE TYPE public.traveller_source AS ENUM ('redirect', 'walkin', 'online', 'partner_referral');
CREATE TYPE public.redirect_status AS ENUM ('new', 'pending', 'matched', 'confirmed', 'cancelled');
CREATE TYPE public.fee_type AS ENUM ('flat', 'percentage');
CREATE TYPE public.fee_status AS ENUM ('pending', 'invoiced', 'paid');

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- PARTNERS
-- =========================
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  fee_agreement_type public.fee_type NOT NULL DEFAULT 'percentage',
  fee_rate NUMERIC(10,2) NOT NULL DEFAULT 10,
  bank_details TEXT,
  status public.partner_status NOT NULL DEFAULT 'onboarding',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT INSERT ON public.partners TO anon;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public onboarding insert" ON public.partners
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "partner read own" ON public.partners
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "partner update own" ON public.partners
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin read partners" ON public.partners
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manage partners" ON public.partners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- PROPERTIES
-- =========================
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type public.property_type NOT NULL,
  location TEXT,
  description TEXT,
  address TEXT,
  parish TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  status public.property_status NOT NULL DEFAULT 'onboarding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT SELECT ON public.properties TO anon;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active properties" ON public.properties
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "partner manage own properties" ON public.properties
  FOR ALL TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()))
  WITH CHECK (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));
CREATE POLICY "admin manage properties" ON public.properties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- ROOMS
-- =========================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_type TEXT,
  name TEXT NOT NULL,
  description TEXT,
  max_guests INTEGER NOT NULL DEFAULT 2,
  price_per_night_xcd NUMERIC(10,2) NOT NULL DEFAULT 0,
  available BOOLEAN NOT NULL DEFAULT true,
  available_from DATE,
  available_to DATE,
  amenities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT SELECT ON public.rooms TO anon;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read rooms" ON public.rooms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "partner manage own rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.partners pa ON pa.id = p.partner_id
    WHERE pa.user_id = auth.uid()
  ))
  WITH CHECK (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.partners pa ON pa.id = p.partner_id
    WHERE pa.user_id = auth.uid()
  ));
CREATE POLICY "admin manage rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- TRAVELLERS
-- =========================
CREATE TABLE public.travellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  nationality TEXT,
  arrival_date DATE,
  departure_date DATE,
  nights_needed INTEGER,
  guest_count INTEGER NOT NULL DEFAULT 1,
  budget_min_xcd NUMERIC(10,2),
  budget_max_xcd NUMERIC(10,2),
  accommodation_type_preference public.property_type,
  notes TEXT,
  source public.traveller_source NOT NULL DEFAULT 'online',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.travellers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travellers TO authenticated;
GRANT ALL ON public.travellers TO service_role;
ALTER TABLE public.travellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public submit traveller" ON public.travellers
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin manage travellers" ON public.travellers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- REDIRECTS
-- =========================
CREATE TABLE public.redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traveller_id UUID NOT NULL REFERENCES public.travellers(id) ON DELETE CASCADE,
  from_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  matched_property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  matched_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  status public.redirect_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.redirects TO authenticated;
GRANT ALL ON public.redirects TO service_role;
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner view own matched redirects" ON public.redirects
  FOR SELECT TO authenticated
  USING (matched_property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.partners pa ON pa.id = p.partner_id
    WHERE pa.user_id = auth.uid()
  ));
CREATE POLICY "admin manage redirects" ON public.redirects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- BOOKINGS
-- =========================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redirect_id UUID REFERENCES public.redirects(id) ON DELETE SET NULL,
  traveller_id UUID REFERENCES public.travellers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  check_in DATE,
  check_out DATE,
  nights INTEGER,
  total_xcd NUMERIC(10,2),
  finders_fee_xcd NUMERIC(10,2),
  fee_type public.fee_type,
  fee_rate NUMERIC(10,2),
  fee_status public.fee_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (property_id IN (
    SELECT p.id FROM public.properties p
    JOIN public.partners pa ON pa.id = p.partner_id
    WHERE pa.user_id = auth.uid()
  ));
CREATE POLICY "admin manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================
-- EARNINGS
-- =========================
CREATE TABLE public.earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  amount_xcd NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.fee_status NOT NULL DEFAULT 'pending',
  invoice_number TEXT,
  invoice_date DATE,
  paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.earnings TO authenticated;
GRANT ALL ON public.earnings TO service_role;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner view own earnings" ON public.earnings
  FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));
CREATE POLICY "admin manage earnings" ON public.earnings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
