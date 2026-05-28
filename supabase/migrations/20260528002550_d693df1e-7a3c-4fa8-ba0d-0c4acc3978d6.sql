ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS rating numeric(3,1) DEFAULT 0;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS parish text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS room_count integer;