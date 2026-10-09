-- ========================================================
-- SURPLUS-SAVER: MUMBAI SEED DATA (POSTGIS GEOLOCATIONS)
-- ========================================================

-- Insert Sample Vendors in Mumbai
INSERT INTO public.vendors (id, name, city, area, address, latitude, longitude, rating)
VALUES
  (
    'a1111111-1111-1111-1111-111111111111',
    'Theobroma Patisserie',
    'Mumbai',
    'Bandra West',
    '24 Turner Road, Bandra West, Mumbai 400050',
    19.0596,
    72.8295,
    4.9
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'Subko Specialty Coffee & Bakehouse',
    'Mumbai',
    'Ranwar Village, Bandra',
    'Craferina House, Chapel Rd, Ranwar, Bandra West, Mumbai 400050',
    19.0543,
    72.8288,
    4.8
  ),
  (
    'a3333333-3333-3333-3333-333333333333',
    'The Bombay Canteen Express',
    'Mumbai',
    'Lower Parel',
    'Kamala Mills Compound, SB Marg, Lower Parel, Mumbai 400013',
    18.9953,
    72.8315,
    4.9
  ),
  (
    'a4444444-4444-4444-4444-444444444444',
    'Punjab Grill Kitchen',
    'Mumbai',
    'BKC',
    'Unit 1, Ground Floor, Godrej BKC, Bandra Kurla Complex, Mumbai 400051',
    19.0657,
    72.8687,
    4.7
  )
ON CONFLICT (id) DO NOTHING;

-- Insert Active Surplus Listings
INSERT INTO public.listings (
  id,
  vendor_id,
  name,
  description,
  category,
  photo_url,
  price_inr,
  original_price_inr,
  quantity,
  pickup_window,
  area,
  latitude,
  longitude,
  dietary_tags,
  expires_at,
  is_active
)
VALUES
  (
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'Artisan Sourdough & Croissant Bag',
    'Freshly baked today morning. Includes 2 country sourdough loaves and a pair of chocolate butter croissants.',
    'Bakery',
    'bakery',
    180,
    450,
    6,
    'Today, 8:00 PM – 9:30 PM',
    'Bandra West',
    19.0596,
    72.8295,
    ARRAY['vegetarian'],
    NOW() + INTERVAL '6 hours',
    TRUE
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'a2222222-2222-2222-2222-222222222222',
    'Cold Brew & Gourmet Panini Combo',
    'Single-origin bottled cold brew paired with roasted mushroom & truffle cheddar toasted sourdough panini.',
    'Cafe',
    'lunch',
    240,
    580,
    4,
    'Today, 7:30 PM – 9:00 PM',
    'Ranwar Village, Bandra',
    19.0543,
    72.8288,
    ARRAY['vegetarian'],
    NOW() + INTERVAL '5 hours',
    TRUE
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'a3333333-3333-3333-3333-333333333333',
    'Regional Indian Lunch Plate Surprise',
    'Chef special meal box: smoked paneer roast, malabar parottas, and seasonal heirloom salad.',
    'Meals',
    'lunch',
    220,
    550,
    5,
    'Tonight, 9:00 PM – 10:30 PM',
    'Lower Parel',
    18.9953,
    72.8315,
    ARRAY['vegetarian'],
    NOW() + INTERVAL '7 hours',
    TRUE
  ),
  (
    'b4444444-4444-4444-4444-444444444444',
    'a4444444-4444-4444-4444-444444444444',
    'Tandoori & Biryani Dinner Box',
    'Dum biryani portion with dal makhani and butter rotis, pre-packed warm in eco containers.',
    'Meals',
    'lunch',
    199,
    499,
    8,
    'Tonight, 9:30 PM – 11:00 PM',
    'BKC',
    19.0657,
    72.8687,
    ARRAY['vegetarian', 'halal'],
    NOW() + INTERVAL '8 hours',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;
