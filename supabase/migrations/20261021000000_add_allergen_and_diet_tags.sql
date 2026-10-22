-- Migration: Add allergen and dietary tags with vendor confirmation
-- Existing listings default to allergen_info_confirmed = false

DO $$
BEGIN
  -- 1. Add diet and allergen arrays
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'diet_tags'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN diet_tags TEXT[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'allergens'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN allergens TEXT[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'may_contain'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN may_contain TEXT[] NOT NULL DEFAULT '{}';
  END IF;

  -- 2. Add confirmation tracking & audit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'allergen_info_confirmed'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN allergen_info_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'allergen_confirmed_at'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN allergen_confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'allergen_confirmed_by'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN allergen_confirmed_by TEXT;
  END IF;

  -- 3. Raw AI suggestion stored for audit & accuracy tracking (never exposed to consumers)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'ai_suggestion'
  ) THEN
    ALTER TABLE public.listings ADD COLUMN ai_suggestion JSONB;
  END IF;
END $$;

-- 4. Fast lookup index for active listings with confirmed allergen/dietary status
CREATE INDEX IF NOT EXISTS listings_diet_allergens_confirmed_idx 
  ON public.listings (allergen_info_confirmed, is_active)
  WHERE is_active = TRUE;
