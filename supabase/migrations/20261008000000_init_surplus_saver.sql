-- 1. Enable PostGIS (for Supabase) & pgcrypto
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS postgis;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Support local schema if auth schema is absent
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT
);

-- 2. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer', 'vendor', 'admin')),
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Vendors / Bakeries / Restaurants
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Mumbai',
  area TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating NUMERIC(3,2) NOT NULL DEFAULT 4.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendors_city_idx ON public.vendors (city);

-- 4. Surplus Food Listings
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Bakery', 'Cafe', 'Meals')),
  photo_url TEXT,
  price_inr INTEGER NOT NULL CHECK (price_inr > 0),
  original_price_inr INTEGER NOT NULL CHECK (original_price_inr >= price_inr),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  pickup_window TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listings_active_expiry_idx ON public.listings (is_active, expires_at);
CREATE INDEX IF NOT EXISTS listings_vendor_idx ON public.listings (vendor_id);

-- 5. Orders (Pickup Reservations)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  consumer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_inr INTEGER NOT NULL,
  total_price_inr INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'PREPARING', 'READY', 'PICKED_UP', 'CANCELLED')),
  pickup_window TEXT NOT NULL,
  qr_code_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  picked_up_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_consumer_idx ON public.orders (consumer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_vendor_idx ON public.orders (vendor_id, created_at DESC);

-- 6. Direct Order Chat (Realtime Messages)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_order_idx ON public.messages (order_id, created_at ASC);

-- 7. Vendor Follows
CREATE TABLE IF NOT EXISTS public.vendor_follows (
  consumer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consumer_id, vendor_id)
);

-- ========================================================
-- POSTGIS STORED PROCEDURE: GET NEARBY LISTINGS
-- ========================================================
CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  max_radius_km DOUBLE PRECISION DEFAULT 10.0
)
RETURNS TABLE (
  id UUID,
  vendor_id UUID,
  name TEXT,
  description TEXT,
  vendor_name TEXT,
  category TEXT,
  price_inr INTEGER,
  original_price_inr INTEGER,
  quantity INTEGER,
  pickup_window TEXT,
  area TEXT,
  distance_km DOUBLE PRECISION,
  dietary_tags TEXT[],
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id,
    l.vendor_id,
    l.name,
    l.description,
    v.name AS vendor_name,
    l.category,
    l.price_inr,
    l.original_price_inr,
    l.quantity,
    l.pickup_window,
    l.area,
    ROUND((
      6371.0 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(user_lat)) * cos(radians(l.latitude)) *
          cos(radians(l.longitude) - radians(user_lng)) +
          sin(radians(user_lat)) * sin(radians(l.latitude))
        ))
      )
    )::numeric, 1)::double precision AS distance_km,
    l.dietary_tags,
    l.expires_at,
    l.created_at
  FROM public.listings l
  JOIN public.vendors v ON v.id = l.vendor_id
  WHERE
    l.is_active = TRUE
    AND l.quantity > 0
    AND l.expires_at > NOW()
  ORDER BY distance_km ASC;
$$;

-- ========================================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_follows ENABLE ROW LEVEL SECURITY;

-- Public read access for active listings & vendors
CREATE POLICY "Public read active listings" ON public.listings FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public read vendors" ON public.vendors FOR SELECT USING (TRUE);

-- Realtime Setup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.listings, public.orders, public.messages;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
