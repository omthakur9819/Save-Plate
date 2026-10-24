import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api-url';

export type FoodCategory = 'Bakery' | 'Cafe' | 'Meals';
export type ListingPhoto = 'bakery' | 'lunch';
export type AppMode = 'shopper' | 'vendor';

export function formatRupees(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface FoodListing {
  id: string;
  name: string;
  vendor: string;
  category: FoodCategory;
  price: number;
  originalPrice: number;
  quantity: number;
  pickupWindow: string;
  area: string;
  distance: string;
  photo: ListingPhoto;
  imageUri?: string;
  latitude: number;
  longitude: number;
  description: string;
  isMine?: boolean;
  dietaryTags?: string[];
  dietTags?: string[];
  allergens?: string[];
  mayContain?: string[];
  allergenInfoConfirmed?: boolean;
  allergenConfirmedAt?: string | null;
  allergenConfirmedBy?: string | null;
  aiSuggestion?: any;
}

export interface PickupOrder {
  id: string;
  listingId: string;
  listingName: string;
  vendor: string;
  quantity: number;
  total: number;
  pickupWindow: string;
  area: string;
  placedAt: string;
  collected: boolean;
  paymentMethod?: 'razorpay' | 'pay_at_pickup';
  paymentId?: string;
  paymentStatus?: 'PAID' | 'PAY_AT_PICKUP';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'shopper' | 'vendor';
  restaurantName?: string;
  area?: string;
  phone?: string;
  savedMoneyInr?: number;
  mealsRescued?: number;
}

export interface RestaurantGroup {
  id: string;
  name: string;
  category: FoodCategory;
  area: string;
  distance: string;
  latitude: number;
  longitude: number;
  rating: number;
  ratingCount: number;
  coverImage?: string;
  dishes: FoodListing[];
  pickupWindow: string;
}

export const DEMO_SHOPPER: UserProfile = {
  id: 'demo-shopper-1',
  name: 'Aarav Sharma',
  email: 'aarav.sharma@gmail.com',
  role: 'shopper',
  area: 'Bandra West',
  savedMoneyInr: 1450,
  mealsRescued: 8,
};

export const DEMO_VENDORS: UserProfile[] = [
  {
    id: 'demo-vendor-veronicas',
    name: 'Chef Daniel & Team',
    email: 'ranwar@veronicasbandra.com',
    role: 'vendor',
    restaurantName: "Veronica's Bandra",
    area: 'Bandra West',
  },
  {
    id: 'demo-vendor-subko',
    name: 'Rahul Reddy',
    email: 'craft@subko.coffee',
    role: 'vendor',
    restaurantName: 'Subko Specialty Coffee & Bakehouse',
    area: 'Bandra West',
  },
  {
    id: 'demo-vendor-theobroma',
    name: 'Kainaz Messman',
    email: 'colaba@theobroma.in',
    role: 'vendor',
    restaurantName: 'Theobroma Colaba',
    area: 'Colaba',
  },
  {
    id: 'demo-vendor-bombaycanteen',
    name: 'Chef Hussain Shahzad',
    email: 'canteen@bombaycanteen.com',
    role: 'vendor',
    restaurantName: 'The Bombay Canteen',
    area: 'Lower Parel',
  },
  {
    id: 'demo-vendor-kyani',
    name: 'Farokh Shokri',
    email: 'heritage@kyanico.in',
    role: 'vendor',
    restaurantName: 'Kyani & Co. Irani Cafe',
    area: 'Marine Drive',
  },
  {
    id: 'demo-vendor-1',
    name: 'Kabir Bakshi',
    email: 'kabir@bandrabread.in',
    role: 'vendor',
    restaurantName: 'Bandra Bread Room',
    area: 'Bandra West',
  },
  {
    id: 'demo-vendor-2',
    name: 'Pooja Mehta',
    email: 'pooja@mangoleaf.in',
    role: 'vendor',
    restaurantName: 'Mango Leaf Cafe',
    area: 'Khar West',
  },
  {
    id: 'demo-vendor-3',
    name: 'Ramesh Patel',
    email: 'ramesh@dabbaco.in',
    role: 'vendor',
    restaurantName: 'Dabba & Co.',
    area: 'Bandra West',
  },
];

interface PersistedState {
  listings: FoodListing[];
  orders: PickupOrder[];
  favorites: string[];
  followedVendors?: string[];
  mode: AppMode;
  currentUser?: UserProfile | null;
}

interface MarketplaceValue extends PersistedState {
  followedVendors: string[];
  isReady: boolean;
  storageError: boolean;
  currentUser: UserProfile | null;
  restaurants: RestaurantGroup[];
  login: (profile: UserProfile) => void;
  logout: () => void;
  register: (profile: Omit<UserProfile, 'id'>) => UserProfile;
  setMode: (mode: AppMode) => void;
  toggleFavorite: (id: string) => void;
  toggleFollowVendor: (vendorNameOrId: string) => Promise<boolean>;
  isVendorFollowed: (vendorNameOrId: string) => boolean;
  placeOrder: (
    listing: FoodListing,
    quantity?: number,
    payment?: { paymentMethod: 'razorpay' | 'pay_at_pickup'; paymentId?: string },
  ) => Promise<boolean>;
  markCollected: (id: string) => void;
  addListing: (
    listing: Omit<FoodListing, 'id' | 'latitude' | 'longitude' | 'isMine'> & {
      latitude?: number;
      longitude?: number;
    },
  ) => string;
}

const STORAGE_KEY = '@goodagain/marketplace-v4';
const OLD_DEMO_AREAS = new Set([
  'Hayes Valley',
  'Lower Haight',
  'Civic Center',
  'Duboce Triangle',
]);

export const MUMBAI_NEIGHBORHOOD_COORDS: Record<string, { latitude: number; longitude: number }> = {
  // South Mumbai (Heritage & Commercial)
  'colaba': { latitude: 18.9067, longitude: 72.8147 },
  'nariman point': { latitude: 18.9260, longitude: 72.8230 },
  'churchgate': { latitude: 18.9322, longitude: 72.8264 },
  'marine drive': { latitude: 18.9432, longitude: 72.8231 },
  'fort': { latitude: 18.9322, longitude: 72.8335 },
  'crawford market': { latitude: 18.9470, longitude: 72.8340 },
  'girgaon': { latitude: 18.9550, longitude: 72.8180 },
  'malabar hill': { latitude: 18.9568, longitude: 72.7997 },
  'kemps corner': { latitude: 18.9640, longitude: 72.8060 },
  "kemp's corner": { latitude: 18.9640, longitude: 72.8060 },
  'pedder road': { latitude: 18.9680, longitude: 72.8090 },
  'breach candy': { latitude: 18.9710, longitude: 72.8040 },
  'haji ali': { latitude: 18.9780, longitude: 72.8100 },
  'tardeo': { latitude: 18.9710, longitude: 72.8150 },
  'byculla': { latitude: 18.9750, longitude: 72.8350 },
  'lower parel': { latitude: 18.9953, longitude: 72.8315 },
  'worli': { latitude: 19.0166, longitude: 72.8166 },
  'prabhadevi': { latitude: 19.0150, longitude: 72.8280 },
  'dadar': { latitude: 19.0178, longitude: 72.8478 },
  'matunga': { latitude: 19.0270, longitude: 72.8550 },
  'mahim': { latitude: 19.0350, longitude: 72.8400 },
  'sion': { latitude: 19.0400, longitude: 72.8620 },

  // Bandra & Western Suburbs
  'bandstand': { latitude: 19.0430, longitude: 72.8190 },
  'ranwar': { latitude: 19.0543, longitude: 72.8288 },
  'ranwar village': { latitude: 19.0543, longitude: 72.8288 },
  'hill road': { latitude: 19.0560, longitude: 72.8310 },
  'bandra west': { latitude: 19.0596, longitude: 72.8295 },
  'bandra': { latitude: 19.0596, longitude: 72.8295 },
  'bandra east': { latitude: 19.0610, longitude: 72.8480 },
  'pali hill': { latitude: 19.0620, longitude: 72.8250 },
  'carter road': { latitude: 19.0650, longitude: 72.8220 },
  'linking road': { latitude: 19.0640, longitude: 72.8335 },
  'khar west': { latitude: 19.0670, longitude: 72.8320 },
  'khar': { latitude: 19.0670, longitude: 72.8320 },
  'santacruz': { latitude: 19.0843, longitude: 72.8360 },
  'santacruz west': { latitude: 19.0843, longitude: 72.8360 },
  'santacruz east': { latitude: 19.0815, longitude: 72.8520 },
  'vile parle': { latitude: 19.0980, longitude: 72.8430 },
  'vile parle west': { latitude: 19.0980, longitude: 72.8360 },
  'vile parle east': { latitude: 19.0960, longitude: 72.8500 },
  'juhu': { latitude: 19.1075, longitude: 72.8263 },
  'juhu beach': { latitude: 19.0988, longitude: 72.8264 },
  'versova': { latitude: 19.1350, longitude: 72.8150 },
  'lokhandwala': { latitude: 19.1430, longitude: 72.8270 },

  // BKC & Central Suburbs
  'bkc': { latitude: 19.0657, longitude: 72.8687 },
  'bandra kurla complex': { latitude: 19.0657, longitude: 72.8687 },
  'kurla': { latitude: 19.0726, longitude: 72.8845 },
  'chembur': { latitude: 19.0522, longitude: 72.8997 },
  'ghatkopar': { latitude: 19.0860, longitude: 72.9080 },
  'powai': { latitude: 19.1176, longitude: 72.9060 },
  'hiranandani': { latitude: 19.1176, longitude: 72.9060 },
  'hiranandani powai': { latitude: 19.1176, longitude: 72.9060 },
  'mulund': { latitude: 19.1720, longitude: 72.9560 },

  // Western North Suburbs
  'andheri west': { latitude: 19.1363, longitude: 72.8277 },
  'andheri east': { latitude: 19.1136, longitude: 72.8697 },
  'andheri': { latitude: 19.1197, longitude: 72.8464 },
  'goregaon': { latitude: 19.1663, longitude: 72.8526 },
  'malad': { latitude: 19.1874, longitude: 72.8484 },
  'kandivali': { latitude: 19.2047, longitude: 72.8522 },
  'borivali': { latitude: 19.2307, longitude: 72.8567 },

  // MMR Extensions
  'thane': { latitude: 19.2183, longitude: 72.9781 },
  'vashi': { latitude: 19.0771, longitude: 72.9986 },
  'navi mumbai': { latitude: 19.0330, longitude: 73.0297 },
  'panvel': { latitude: 18.9894, longitude: 73.1175 },
};

export const POPULAR_MUMBAI_AREAS = [
  'Bandra West',
  'Khar West',
  'Pali Hill',
  'Carter Road',
  'Linking Road',
  'Juhu',
  'Versova',
  'BKC',
  'Lower Parel',
  'Worli',
  'Colaba',
  'Marine Drive',
  'Churchgate',
  'Fort',
  'Dadar',
  'Andheri West',
  'Lokhandwala',
  'Vile Parle',
  'Powai',
  'Chembur',
  'Borivali',
  'Thane',
  'Vashi',
  'Panvel',
] as const;

export function getCoordinatesForArea(
  area: string,
  seed: string | number = 0,
): { latitude: number; longitude: number } {
  const clean = (area || '').trim().toLowerCase();
  let base = { latitude: 19.0596, longitude: 72.8295 };

  if (MUMBAI_NEIGHBORHOOD_COORDS[clean]) {
    base = MUMBAI_NEIGHBORHOOD_COORDS[clean];
  } else {
    for (const [key, coords] of Object.entries(MUMBAI_NEIGHBORHOOD_COORDS)) {
      if (clean.includes(key) || key.includes(clean)) {
        base = coords;
        break;
      }
    }
  }

  if (!seed || seed === 0) {
    return { latitude: base.latitude, longitude: base.longitude };
  }

  const seedStr = `${clean}-${seed}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((Math.abs(hash) % 7) - 3) * 0.0003);
  const lngOffset = ((((Math.abs(hash) >> 2) % 7) - 3) * 0.0003);

  return {
    latitude: Number((base.latitude + latOffset).toFixed(5)),
    longitude: Number((base.longitude + lngOffset).toFixed(5)),
  };
}

// Default seed listings: each restaurant has multiple delicious surplus dishes
const DEFAULT_LISTINGS: FoodListing[] = [
  // Restaurant 1: Bandra Bread Room (3 dishes)
  {
    id: 'bbr-surprise-bag',
    name: 'Surprise bakery bag',
    vendor: 'Bandra Bread Room',
    category: 'Bakery',
    price: 149,
    originalPrice: 399,
    quantity: 4,
    pickupWindow: 'Today, 5:30–6:30 PM',
    area: 'Bandra West',
    distance: '0.5 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0593,
    longitude: 72.829,
    description: 'A happy mix of today’s extra sourdough, croissants, and butter brioche. Freshly baked this morning.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg'],
    mayContain: ['tree_nuts', 'sesame'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'bbr-pastry-box',
    name: 'Assorted pastry box',
    vendor: 'Bandra Bread Room',
    category: 'Bakery',
    price: 199,
    originalPrice: 549,
    quantity: 2,
    pickupWindow: 'Today, 6:00–7:00 PM',
    area: 'Bandra West',
    distance: '0.5 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0593,
    longitude: 72.829,
    description: 'Four decadent assorted tarts, chocolate eclairs, and fruit Danishes packed right before closing.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg', 'soy'],
    mayContain: ['tree_nuts', 'peanuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'bbr-sourdough-focaccia',
    name: 'Artisan Sourdough & Herb Focaccia',
    vendor: 'Bandra Bread Room',
    category: 'Bakery',
    price: 129,
    originalPrice: 340,
    quantity: 3,
    pickupWindow: 'Today, 6:30–7:30 PM',
    area: 'Bandra West',
    distance: '0.5 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0593,
    longitude: 72.829,
    description: 'Crusty rustic sourdough loaf accompanied by olive oil rosemary sea salt focaccia.',
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    dietTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    allergens: ['gluten'],
    mayContain: ['sesame', 'tree_nuts'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 2: Mango Leaf Cafe (3 dishes)
  {
    id: 'mlc-harvest-bowl',
    name: 'Monsoon harvest lunch bowl',
    vendor: 'Mango Leaf Cafe',
    category: 'Cafe',
    price: 159,
    originalPrice: 425,
    quantity: 3,
    pickupWindow: 'Today, 4:00–5:00 PM',
    area: 'Khar West',
    distance: '1.5 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    latitude: 19.067,
    longitude: 72.832,
    description: 'A fresh seasonal grain bowl with roasted sweet potato, kale, edamame and lemon tahini drizzle.',
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free', 'gluten-free'],
    dietTags: ['vegan', 'vegetarian', 'dairy-free', 'gluten-free'],
    allergens: ['sesame', 'soy'],
    mayContain: ['peanuts', 'tree_nuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'mlc-matcha-croissant',
    name: 'Iced Cold Brew & Cinnamon Roll',
    vendor: 'Mango Leaf Cafe',
    category: 'Cafe',
    price: 129,
    originalPrice: 320,
    quantity: 5,
    pickupWindow: 'Today, 4:30–5:30 PM',
    area: 'Khar West',
    distance: '1.5 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
    latitude: 19.067,
    longitude: 72.832,
    description: 'Slow-steeped 16-hour single-origin cold brew paired with an artisanal glazed cinnamon bun.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg'],
    mayContain: ['tree_nuts', 'soy'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'mlc-avocado-toast',
    name: 'Smoked Paneer Bagel & Berry Tart',
    vendor: 'Mango Leaf Cafe',
    category: 'Cafe',
    price: 139,
    originalPrice: 360,
    quantity: 2,
    pickupWindow: 'Today, 5:00–6:00 PM',
    area: 'Khar West',
    distance: '1.5 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    latitude: 19.067,
    longitude: 72.832,
    description: 'Toasted multigrain bagel filled with grilled spiced paneer, microgreens and house mint chutney.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['gluten', 'milk'],
    mayContain: ['sesame', 'tree_nuts', 'soy'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 3: Dabba & Co. (3 dishes)
  {
    id: 'dc-veg-tiffin',
    name: 'Tonight’s veg tiffin',
    vendor: 'Dabba & Co.',
    category: 'Meals',
    price: 189,
    originalPrice: 480,
    quantity: 2,
    pickupWindow: 'Today, 6:30–7:30 PM',
    area: 'Bandra West',
    distance: '1.8 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
    latitude: 19.053,
    longitude: 72.836,
    description: 'A hearty home-style tiffin with paneer butter masala, yellow dal tadka, jeera rice and 3 hot phulkas.',
    dietaryTags: ['vegetarian', 'eggless', 'jain'],
    dietTags: ['vegetarian', 'eggless', 'jain'],
    allergens: ['milk', 'gluten'],
    mayContain: ['tree_nuts', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'dc-biryani-box',
    name: 'Dum Hyderabadi Veg Biryani Box',
    vendor: 'Dabba & Co.',
    category: 'Meals',
    price: 199,
    originalPrice: 499,
    quantity: 3,
    pickupWindow: 'Today, 7:00–8:00 PM',
    area: 'Bandra West',
    distance: '1.8 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    latitude: 19.053,
    longitude: 72.836,
    description: 'Fragrant basmati rice layered with marinated vegetables, saffron, crispy fried onions and cool mint raita.',
    dietaryTags: ['vegetarian', 'eggless', 'gluten-free'],
    dietTags: ['vegetarian', 'eggless', 'gluten-free'],
    allergens: ['milk'],
    mayContain: ['tree_nuts', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'dc-rajma-chawal',
    name: 'Amritsari Chole Kulche Box',
    vendor: 'Dabba & Co.',
    category: 'Meals',
    price: 149,
    originalPrice: 360,
    quantity: 4,
    pickupWindow: 'Today, 7:30–8:30 PM',
    area: 'Bandra West',
    distance: '1.8 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    latitude: 19.053,
    longitude: 72.836,
    description: 'Slow-cooked spiced chickpeas served with two fluffy stuffed kulchas, pickled onions and tangy chutney.',
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    dietTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    allergens: ['gluten'],
    mayContain: ['mustard', 'sesame'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 4: Veronica's Bandra (Cult Ranwar Village cafe & deli from official menu)
  {
    id: 'veronicas-avo-snob',
    name: 'The Avo Snob (Burrata & Basil Pesto Ciabatta)',
    vendor: "Veronica's Bandra",
    category: 'Cafe',
    price: 240,
    originalPrice: 650,
    quantity: 3,
    pickupWindow: 'Today, 5:30–7:00 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Marinated heirloom tomatoes, fragrant house basil pesto, fresh burrata on crusty artisan ciabatta.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['milk', 'gluten', 'tree_nuts'],
    mayContain: ['soy', 'sesame'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-chilli-cheese-melt',
    name: 'Mumbai Chilli Cheese Melt',
    vendor: "Veronica's Bandra",
    category: 'Cafe',
    price: 159,
    originalPrice: 425,
    quantity: 4,
    pickupWindow: 'Today, 5:30–7:00 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Sharp cheddar, pickled jalapeños, and spiced naga hot honey pressed on golden toasted milk loaf.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['milk', 'gluten'],
    mayContain: ['soy', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-pass-the-pastrami',
    name: 'Pass The Pastrami Deli Sandwich',
    vendor: "Veronica's Bandra",
    category: 'Cafe',
    price: 290,
    originalPrice: 775,
    quantity: 2,
    pickupWindow: 'Today, 6:00–7:00 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'House-cured spiced pastrami, stone-ground wholegrain mustard, and dill pickles on hearty milk loaf.',
    dietaryTags: ['halal'],
    dietTags: ['halal'],
    allergens: ['gluten', 'mustard', 'milk'],
    mayContain: ['soy', 'egg'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-truffle-mushroom-puff',
    name: 'Truffle Mushroom Puff',
    vendor: "Veronica's Bandra",
    category: 'Bakery',
    price: 89,
    originalPrice: 220,
    quantity: 5,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Golden flaky all-butter French puff pastry stuffed with roasted wild mushrooms and white truffle cream.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['gluten', 'milk'],
    mayContain: ['tree_nuts', 'sesame'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-kouign-amann',
    name: 'Orange Custard Kouign-Amann',
    vendor: "Veronica's Bandra",
    category: 'Bakery',
    price: 119,
    originalPrice: 325,
    quantity: 3,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Caramelized Brittany layered pastry filled with silky orange zest custard and candied citrus peel.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg'],
    mayContain: ['tree_nuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-burra-burra-bowl',
    name: 'Burra Burra Salad Bowl',
    vendor: "Veronica's Bandra",
    category: 'Meals',
    price: 210,
    originalPrice: 650,
    quantity: 2,
    pickupWindow: 'Today, 5:30–7:00 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Crispy house greens, creamy burrata ball, heirloom tomatoes, crunchy puffed quinoa, and basil vinaigrette.',
    dietaryTags: ['vegetarian', 'gluten-free', 'eggless'],
    dietTags: ['vegetarian', 'gluten-free', 'eggless'],
    allergens: ['milk'],
    mayContain: ['tree_nuts', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'veronicas-ferrero-pac',
    name: 'Messy Ferrero Rocher PAC',
    vendor: "Veronica's Bandra",
    category: 'Bakery',
    price: 125,
    originalPrice: 325,
    quantity: 3,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Bandra West',
    distance: '0.4 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0544,
    longitude: 72.8277,
    description: 'Pain au chocolat overloaded with dark chocolate ganache, roasted hazelnut praline, and Ferrero Rocher.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'tree_nuts', 'soy'],
    mayContain: ['peanuts', 'egg'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 5: Subko Specialty Coffee & Bakehouse (Ranwar, Bandra West)
  {
    id: 'subko-babka-slice',
    name: 'Subko Sourdough Chocolate Babka Slice',
    vendor: 'Subko Specialty Coffee & Bakehouse',
    category: 'Bakery',
    price: 129,
    originalPrice: 345,
    quantity: 4,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Bandra West',
    distance: '0.6 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0552,
    longitude: 72.8285,
    description: 'Handcrafted laminated brioche loaf swirled with 70% single-origin Malabar dark chocolate ganache.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg', 'soy'],
    mayContain: ['tree_nuts', 'peanuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'subko-coldbrew-croissant',
    name: 'Cascara Cold Brew & Almond Croissant Duo',
    vendor: 'Subko Specialty Coffee & Bakehouse',
    category: 'Cafe',
    price: 169,
    originalPrice: 480,
    quantity: 3,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Bandra West',
    distance: '0.6 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0552,
    longitude: 72.8285,
    description: 'Single-origin estate cold brew paired with twice-baked frangipane almond croissant.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg', 'tree_nuts'],
    mayContain: ['peanuts', 'soy'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'subko-podhi-toastie',
    name: 'Podhi Butter & Aged Cheddar Toastie',
    vendor: 'Subko Specialty Coffee & Bakehouse',
    category: 'Cafe',
    price: 145,
    originalPrice: 395,
    quantity: 3,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Bandra West',
    distance: '0.6 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0552,
    longitude: 72.8285,
    description: 'Gunpowder podhi spiced butter and molten aged cheddar grilled on 48-hour fermented sourdough.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['gluten', 'milk', 'sesame'],
    mayContain: ['mustard', 'tree_nuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'subko-cardamom-cruffin',
    name: 'Coorg Cardamom Sourdough Cruffin',
    vendor: 'Subko Specialty Coffee & Bakehouse',
    category: 'Bakery',
    price: 99,
    originalPrice: 290,
    quantity: 5,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Bandra West',
    distance: '0.6 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0552,
    longitude: 72.8285,
    description: 'Flaky croissant-muffin hybrid dusted in aromatic Coorg green cardamom sugar with vanilla pastry core.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg'],
    mayContain: ['tree_nuts'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 6: Theobroma Colaba (Colaba Causeway)
  {
    id: 'theo-brownie-trio',
    name: 'Overload Brownie Box (Pack of 3)',
    vendor: 'Theobroma Colaba',
    category: 'Bakery',
    price: 159,
    originalPrice: 420,
    quantity: 5,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Colaba',
    distance: '1.2 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1589218436045-ee320057f443?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9215,
    longitude: 72.832,
    description: "Theobroma's cult classic trio: walnut brownie, millionaires caramel brownie, and signature dark chocolate overload.",
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg', 'tree_nuts', 'soy'],
    mayContain: ['peanuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'theo-chocolate-loaf',
    name: 'Dense Chocolate Tea Cake Loaf',
    vendor: 'Theobroma Colaba',
    category: 'Bakery',
    price: 119,
    originalPrice: 320,
    quantity: 4,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Colaba',
    distance: '1.2 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9215,
    longitude: 72.832,
    description: 'Old-school dense moist cocoa tea cake baked fresh this morning, perfect with evening tea.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg', 'soy'],
    mayContain: ['tree_nuts', 'peanuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'theo-chicken-puff',
    name: 'Chicken & Jalapeño Cheese Puff Trio',
    vendor: 'Theobroma Colaba',
    category: 'Cafe',
    price: 135,
    originalPrice: 360,
    quantity: 3,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Colaba',
    distance: '1.2 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9215,
    longitude: 72.832,
    description: 'Three buttery golden puff pastries filled with pulled spiced roast chicken, melted cheddar, and jalapeños.',
    dietaryTags: ['halal'],
    dietTags: ['halal'],
    allergens: ['gluten', 'milk'],
    mayContain: ['egg', 'mustard', 'sesame'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 7: The Bombay Canteen (Kamala Mills, Lower Parel)
  {
    id: 'tbc-jackfruit-tacos',
    name: 'Chettinad Spiced Jackfruit Tacos',
    vendor: 'The Bombay Canteen',
    category: 'Meals',
    price: 190,
    originalPrice: 550,
    quantity: 3,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Lower Parel',
    distance: '2.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9995,
    longitude: 72.8255,
    description: 'Flaky Malabar parotta shell tacos with slow-braised raw jackfruit in fragrant Chettinad black pepper masala.',
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    dietTags: ['vegan', 'vegetarian', 'dairy-free', 'eggless'],
    allergens: ['gluten', 'mustard'],
    mayContain: ['tree_nuts', 'sesame'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'tbc-dal-makhani-box',
    name: 'Canteen Dal Makhani & Flaky Parotta Box',
    vendor: 'The Bombay Canteen',
    category: 'Meals',
    price: 155,
    originalPrice: 440,
    quantity: 4,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Lower Parel',
    distance: '2.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9995,
    longitude: 72.8255,
    description: 'Overnight slow-simmered black urad dal with churned white butter, accompanied by two crisp layered parottas.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['gluten', 'milk'],
    mayContain: ['mustard', 'tree_nuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'tbc-coffee-rasgulla',
    name: 'Filter Coffee Rasgulla Sundae',
    vendor: 'The Bombay Canteen',
    category: 'Meals',
    price: 130,
    originalPrice: 380,
    quantity: 3,
    pickupWindow: 'Today, 6:00–7:30 PM',
    area: 'Lower Parel',
    distance: '2.4 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9995,
    longitude: 72.8255,
    description: 'Chilled spongy cottage cheese rasgullas soaked in dark Mysore filter coffee caramel with toasted cashews.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['milk', 'tree_nuts'],
    mayContain: ['peanuts', 'gluten'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 8: Kyani & Co. Irani Cafe (Marine Drive / Metro Cinema)
  {
    id: 'kyani-bun-maska-mawa',
    name: 'Irani Bun Maska & Parsi Mawa Cake Pair',
    vendor: 'Kyani & Co. Irani Cafe',
    category: 'Cafe',
    price: 69,
    originalPrice: 180,
    quantity: 6,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Marine Drive',
    distance: '2.1 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9412,
    longitude: 72.828,
    description: "Mumbai's legendary soft sweet bun slathered with Amul butter paired with Kyani's century-old spiced mawa cake.",
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['gluten', 'milk', 'egg'],
    mayContain: ['tree_nuts', 'sesame'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'kyani-mutton-kheema',
    name: 'Spiced Mutton Kheema Pao Box',
    vendor: 'Kyani & Co. Irani Cafe',
    category: 'Meals',
    price: 99,
    originalPrice: 260,
    quantity: 4,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Marine Drive',
    distance: '2.1 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9412,
    longitude: 72.828,
    description: 'Slow-braised spiced minced mutton with mint and green chillies, served with two fresh bakery ladi pavs.',
    dietaryTags: ['halal'],
    dietTags: ['halal'],
    allergens: ['gluten'],
    mayContain: ['milk', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'kyani-custard-chai',
    name: 'Heritage Caramel Custard & Kadak Chai',
    vendor: 'Kyani & Co. Irani Cafe',
    category: 'Cafe',
    price: 85,
    originalPrice: 220,
    quantity: 5,
    pickupWindow: 'Today, 5:00–6:30 PM',
    area: 'Marine Drive',
    distance: '2.1 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
    latitude: 18.9412,
    longitude: 72.828,
    description: 'Wobbly baked caramel egg pudding accompanied by a steaming flask of ginger cardamomy Irani kadak chai.',
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['milk', 'egg'],
    mayContain: ['tree_nuts'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 9: Bastian Bandra (Linking Road, Bandra West)
  {
    id: 'bastian-prawn-roll',
    name: 'Butter Garlic Prawn Brioche Roll & Fries',
    vendor: 'Bastian Bandra',
    category: 'Meals',
    price: 299,
    originalPrice: 850,
    quantity: 2,
    pickupWindow: 'Today, 6:30–8:00 PM',
    area: 'Bandra West',
    distance: '0.8 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0625,
    longitude: 72.8315,
    description: 'Plump coastal prawns pan-seared in browned garlic herb butter, nestled in a toasted brioche roll with fries.',
    dietaryTags: [],
    dietTags: [],
    allergens: ['shellfish', 'milk', 'gluten', 'egg'],
    mayContain: ['fish', 'soy'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'bastian-truffle-mac',
    name: 'Black Truffle Mac & Three Cheese Skillet',
    vendor: 'Bastian Bandra',
    category: 'Meals',
    price: 240,
    originalPrice: 680,
    quantity: 3,
    pickupWindow: 'Today, 6:30–8:00 PM',
    area: 'Bandra West',
    distance: '0.8 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0625,
    longitude: 72.8315,
    description: 'Creamy elbow macaroni baked with aged cheddar, gruyère, fontina cheese, and aromatic Italian truffle oil.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['gluten', 'milk'],
    mayContain: ['tree_nuts', 'soy'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'bastian-biscoff-cheesecake',
    name: 'Signature Lotus Biscoff Cheesecake Slice',
    vendor: 'Bastian Bandra',
    category: 'Bakery',
    price: 199,
    originalPrice: 550,
    quantity: 3,
    pickupWindow: 'Today, 6:30–8:00 PM',
    area: 'Bandra West',
    distance: '0.8 km',
    photo: 'bakery',
    imageUri: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=600&q=80',
    latitude: 19.0625,
    longitude: 72.8315,
    description: "Bastian's iconic dessert: velvety rich New York style baked cheesecake layered on spiced speculoos Biscoff crust.",
    dietaryTags: ['vegetarian'],
    dietTags: ['vegetarian'],
    allergens: ['milk', 'gluten', 'egg', 'soy'],
    mayContain: ['tree_nuts', 'peanuts'],
    allergenInfoConfirmed: true,
  },

  // Restaurant 10: Mirchi & Mime (Hiranandani, Powai)
  {
    id: 'mm-butter-chicken-box',
    name: 'Dilli 6 Butter Chicken & Garlic Naan Box',
    vendor: 'Mirchi & Mime',
    category: 'Meals',
    price: 175,
    originalPrice: 480,
    quantity: 4,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Powai',
    distance: '3.2 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
    latitude: 19.1185,
    longitude: 72.909,
    description: 'Charcoal grilled tandoori chicken chunks simmered in velvet makhani gravy with freshly baked butter garlic naan.',
    dietaryTags: ['halal'],
    dietTags: ['halal'],
    allergens: ['milk', 'gluten', 'tree_nuts'],
    mayContain: ['mustard', 'peanuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'mm-dum-aloo-pulao',
    name: 'Kashmiri Dum Aloo & Jeera Pulao Meal',
    vendor: 'Mirchi & Mime',
    category: 'Meals',
    price: 139,
    originalPrice: 390,
    quantity: 3,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Powai',
    distance: '3.2 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    latitude: 19.1185,
    longitude: 72.909,
    description: 'Baby potatoes simmered in rich fennel-infused red gravy, paired with aromatic cumin long-grain basmati rice.',
    dietaryTags: ['vegan', 'vegetarian', 'dairy-free', 'gluten-free', 'jain'],
    dietTags: ['vegan', 'vegetarian', 'dairy-free', 'gluten-free', 'jain'],
    allergens: [],
    mayContain: ['mustard', 'tree_nuts'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'mm-paneer-tikka-biryani',
    name: 'Smoked Paneer Tikka Dum Biryani Box',
    vendor: 'Mirchi & Mime',
    category: 'Meals',
    price: 165,
    originalPrice: 450,
    quantity: 4,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Powai',
    distance: '3.2 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    latitude: 19.1185,
    longitude: 72.909,
    description: 'Slow-cooked fragrant basmati rice layered with clay-oven smoked malai paneer tikka, served with cucumber mint raita.',
    dietaryTags: ['vegetarian', 'gluten-free'],
    dietTags: ['vegetarian', 'gluten-free'],
    allergens: ['milk'],
    mayContain: ['tree_nuts', 'mustard'],
    allergenInfoConfirmed: true,
  },
  {
    id: 'mm-gulab-jamun-rabdi',
    name: 'Warm Gulab Jamun & Kesari Rabdi Duo',
    vendor: 'Mirchi & Mime',
    category: 'Meals',
    price: 110,
    originalPrice: 280,
    quantity: 5,
    pickupWindow: 'Today, 7:00–8:30 PM',
    area: 'Powai',
    distance: '3.2 km',
    photo: 'lunch',
    imageUri: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?auto=format&fit=crop&w=600&q=80',
    latitude: 19.1185,
    longitude: 72.909,
    description: 'Melt-in-mouth milk mawa jamuns steeped in green cardamom sugar syrup, topped with thick saffron almond rabdi.',
    dietaryTags: ['vegetarian', 'eggless'],
    dietTags: ['vegetarian', 'eggless'],
    allergens: ['milk', 'gluten', 'tree_nuts'],
    mayContain: ['peanuts'],
    allergenInfoConfirmed: true,
  },
];

export const VENDOR_METADATA: Record<string, { coverImage: string; rating: number; ratingCount: number }> = {
  "Veronica's Bandra": {
    coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    ratingCount: 420,
  },
  "Veronica's": {
    coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    ratingCount: 420,
  },
  'Subko Specialty Coffee & Bakehouse': {
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    ratingCount: 540,
  },
  'Theobroma Colaba': {
    coverImage: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    ratingCount: 650,
  },
  'The Bombay Canteen': {
    coverImage: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    ratingCount: 820,
  },
  'Kyani & Co. Irani Cafe': {
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    rating: 4.7,
    ratingCount: 910,
  },
  'Bastian Bandra': {
    coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    ratingCount: 740,
  },
  'Mirchi & Mime': {
    coverImage: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    ratingCount: 360,
  },
  'Bandra Bread Room': {
    coverImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    rating: 4.8,
    ratingCount: 230,
  },
  'Mango Leaf Cafe': {
    coverImage: 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=600&q=80',
    rating: 4.7,
    ratingCount: 185,
  },
  'Dabba & Co.': {
    coverImage: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=600&q=80',
    rating: 4.9,
    ratingCount: 310,
  },
};

const MarketplaceContext = createContext<MarketplaceValue | null>(null);

export function MarketplaceProvider({ children }: PropsWithChildren) {
  const [listings, setListings] = useState<FoodListing[]>(DEFAULT_LISTINGS);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [followedVendors, setFollowedVendors] = useState<string[]>([]);
  const [mode, setMode] = useState<AppMode>('shopper');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(DEMO_SHOPPER);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState(false);

  const listingsRef = useRef<FoodListing[]>(DEFAULT_LISTINGS);
  const ordersRef = useRef<PickupOrder[]>([]);
  const favoritesRef = useRef<string[]>([]);
  const followedVendorsRef = useRef<string[]>([]);
  const modeRef = useRef<AppMode>('shopper');
  const userRef = useRef<UserProfile | null>(DEMO_SHOPPER);

  listingsRef.current = listings;
  ordersRef.current = orders;
  favoritesRef.current = favorites;
  followedVendorsRef.current = followedVendors;
  modeRef.current = mode;
  userRef.current = currentUser;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          const saved = JSON.parse(raw) as Partial<PersistedState>;
          const rawStored = saved.listings ?? DEFAULT_LISTINGS;
          const existingIds = new Set(rawStored.map((i) => i.id));
          const missingDefaults = DEFAULT_LISTINGS.filter((d) => !existingIds.has(d.id));
          const storedListings = [...rawStored, ...missingDefaults];
          const localizedListings = storedListings.map((item) => {
            const sample = DEFAULT_LISTINGS.find((defaultItem) => defaultItem.id === item.id);
            if (sample) return { ...item, ...sample, quantity: item.quantity };
            if (item.isMine) {
              const cleanArea = OLD_DEMO_AREAS.has(item.area) ? 'Bandra West' : (item.area || 'Bandra West');
              const needsNewCoords =
                !item.latitude ||
                !item.longitude ||
                (Math.abs(item.latitude - 19.0593) < 0.0001 && Math.abs(item.longitude - 72.829) < 0.0001);
              const coords = needsNewCoords
                ? getCoordinatesForArea(cleanArea, item.id)
                : { latitude: item.latitude, longitude: item.longitude };
              return {
                ...item,
                area: cleanArea,
                latitude: coords.latitude,
                longitude: coords.longitude,
              };
            }
            return item;
          });

          const localizedOrders = (saved.orders ?? []).map((order) => {
            const sample = DEFAULT_LISTINGS.find((item) => item.id === order.listingId);
            return {
              ...order,
              area: sample?.area ?? (OLD_DEMO_AREAS.has(order.area) ? 'Bandra West' : order.area),
            };
          });

          const savedFollows = saved.followedVendors ?? [];

          listingsRef.current = localizedListings;
          ordersRef.current = localizedOrders;
          favoritesRef.current = saved.favorites ?? [];
          followedVendorsRef.current = savedFollows;
          modeRef.current = saved.mode ?? 'shopper';
          userRef.current = saved.currentUser !== undefined ? saved.currentUser : DEMO_SHOPPER;

          setListings(localizedListings);
          setOrders(localizedOrders);
          setFavorites(saved.favorites ?? []);
          setFollowedVendors(savedFollows);
          setMode(saved.mode ?? 'shopper');
          setCurrentUser(userRef.current);

          // Background sync followed vendors from Drizzle backend
          try {
            const apiUrl = getApiUrl();
            fetch(`${apiUrl}/api/vendors/following`, {
              headers: { 'x-marketplace-user-id': 'demo-consumer-1' },
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((backendFollows: Array<{ name: string; vendorId: string }> | null) => {
                if (alive && Array.isArray(backendFollows) && backendFollows.length > 0) {
                  const names = backendFollows.map((b) => b.name);
                  const merged = Array.from(new Set([...savedFollows, ...names]));
                  followedVendorsRef.current = merged;
                  setFollowedVendors(merged);
                }
              })
              .catch(() => {});
          } catch {}
        }
      })
      .catch((err) => {
        console.error('[MarketplaceContext] storage read error:', err);
        if (alive) setStorageError(true);
      })
      .finally(() => {
        if (alive) setIsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: Partial<PersistedState>) => {
    const nextListings = next.listings ?? listingsRef.current;
    const nextOrders = next.orders ?? ordersRef.current;
    const nextFavorites = next.favorites ?? favoritesRef.current;
    const nextFollowed = next.followedVendors ?? followedVendorsRef.current;
    const nextMode = next.mode ?? modeRef.current;
    const nextUser = next.currentUser !== undefined ? next.currentUser : userRef.current;

    listingsRef.current = nextListings;
    ordersRef.current = nextOrders;
    favoritesRef.current = nextFavorites;
    followedVendorsRef.current = nextFollowed;
    modeRef.current = nextMode;
    userRef.current = nextUser;

    setListings(nextListings);
    setOrders(nextOrders);
    setFavorites(nextFavorites);
    setFollowedVendors(nextFollowed);
    setMode(nextMode);
    setCurrentUser(nextUser);

    const payload: PersistedState = {
      listings: nextListings,
      orders: nextOrders,
      favorites: nextFavorites,
      followedVendors: nextFollowed,
      mode: nextMode,
      currentUser: nextUser,
    };

    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch((err) => {
      console.error('[MarketplaceContext] failed saving to AsyncStorage:', err);
      setStorageError(true);
    });
  }, []);

  // Compute restaurants by grouping listings under each vendor
  const restaurants = useMemo<RestaurantGroup[]>(() => {
    const map: Record<string, RestaurantGroup> = {};

    for (const item of listings) {
      const vName = item.vendor || 'Local Kitchen';
      if (!map[vName]) {
        const meta = VENDOR_METADATA[vName];
        map[vName] = {
          id: `rest-${vName.toLowerCase().replace(/[^\w]/g, '-')}`,
          name: vName,
          category: item.category,
          area: item.area,
          distance: item.distance || '0.4 km',
          latitude: item.latitude,
          longitude: item.longitude,
          rating: meta?.rating ?? 4.8,
          ratingCount: meta?.ratingCount ?? 84,
          coverImage: meta?.coverImage ?? item.imageUri,
          dishes: [],
          pickupWindow: item.pickupWindow,
        };
      }
      map[vName].dishes.push(item);
    }

    return Object.values(map);
  }, [listings]);

  const value = useMemo<MarketplaceValue>(
    () => ({
      listings,
      orders,
      favorites,
      followedVendors,
      mode,
      currentUser,
      restaurants,
      isReady,
      storageError,
      login: (profile: UserProfile) => {
        save({
          currentUser: profile,
          mode: profile.role,
        });
      },
      logout: () => {
        save({
          currentUser: null,
          mode: 'shopper',
        });
      },
      register: (profileData: Omit<UserProfile, 'id'>) => {
        const newProfile: UserProfile = {
          ...profileData,
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          savedMoneyInr: 0,
          mealsRescued: 0,
        };
        save({
          currentUser: newProfile,
          mode: newProfile.role,
        });
        return newProfile;
      },
      setMode: (nextMode) => save({ mode: nextMode }),
      toggleFavorite: (id) => {
        const cur = favoritesRef.current;
        const nextFavorites = cur.includes(id)
          ? cur.filter((favoriteId) => favoriteId !== id)
          : [...cur, id];
        save({ favorites: nextFavorites });
      },
      toggleFollowVendor: async (vendorNameOrId: string) => {
        const norm = vendorNameOrId.trim();
        const cur = followedVendorsRef.current;
        const isFollowing = cur.some((v) => v.toLowerCase() === norm.toLowerCase());
        const nextFollowed = isFollowing
          ? cur.filter((v) => v.toLowerCase() !== norm.toLowerCase())
          : [...cur, norm];
        save({ followedVendors: nextFollowed });

        try {
          const apiUrl = getApiUrl();
          const effectiveUserId = (!currentUser || currentUser.role === 'vendor' || currentUser.id?.includes('vendor'))
            ? 'demo-consumer-1'
            : currentUser.id;

          await fetch(`${apiUrl}/api/vendors/${encodeURIComponent(norm)}/follow`, {
            method: isFollowing ? 'DELETE' : 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-marketplace-user-id': effectiveUserId,
            },
          });
        } catch (err) {
          console.warn('[toggleFollowVendor] Sync skipped:', err);
        }
        return !isFollowing;
      },
      isVendorFollowed: (vendorNameOrId: string) => {
        const norm = (vendorNameOrId || '').toLowerCase().trim();
        return followedVendorsRef.current.some((v) => v.toLowerCase().trim() === norm);
      },
      placeOrder: async (listing, quantity = 1, payment) => {
        const curListings = listingsRef.current;
        const current = curListings.find((item) => item.id === listing.id);
        if (!current || current.quantity < quantity || quantity < 1) return false;
        const orderId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const paymentMethod = payment?.paymentMethod || 'pay_at_pickup';
        const paymentStatus = paymentMethod === 'razorpay' ? 'PAID' : 'PAY_AT_PICKUP';
        const order: PickupOrder = {
          id: orderId,
          listingId: current.id,
          listingName: current.name,
          vendor: current.vendor,
          quantity,
          total: current.price * quantity,
          pickupWindow: current.pickupWindow,
          area: current.area,
          placedAt: new Date().toISOString(),
          collected: false,
          paymentMethod,
          paymentId: payment?.paymentId,
          paymentStatus,
        };
        const nextListings = curListings.map((item) =>
          item.id === current.id
            ? { ...item, quantity: item.quantity - quantity }
            : item,
        );
        save({ listings: nextListings, orders: [order, ...ordersRef.current] });

        // Sync order to Drizzle PostgreSQL backend
        try {
          const apiUrl = getApiUrl();
          const res = await fetch(`${apiUrl}/api/sync/order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-marketplace-user-id': (!currentUser || currentUser.role === 'vendor' || currentUser.id?.includes('vendor'))
                ? 'demo-consumer-1'
                : currentUser.id,
            },
            body: JSON.stringify({
              listingId: current.id,
              listingName: current.name,
              vendor: current.vendor,
              quantity,
              unitPrice: current.price,
              originalUnitPrice: current.originalPrice,
              totalPrice: current.price * quantity,
              pickupWindow: current.pickupWindow,
              pickupArea: current.area,
              status: 'RESERVED',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            console.log('[sync/order] Synced order to PostgreSQL:', data);
          }
        } catch (err) {
          console.warn('[sync/order] skipped sync:', err);
        }

        // Optional Supabase background sync
        supabase
          .from('orders')
          .insert({
            quantity,
            unit_price_inr: current.price,
            total_price_inr: current.price * quantity,
            pickup_window: current.pickupWindow,
          })
          .then(() => {}, () => {});

        return true;
      },
      markCollected: async (id) => {
        const order = ordersRef.current.find((o) => o.id === id);
        save({
          orders: ordersRef.current.map((order) =>
            order.id === id ? { ...order, collected: true } : order,
          ),
        });

        try {
          const apiUrl = getApiUrl();
          await fetch(`${apiUrl}/api/sync/order/status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-marketplace-user-id': (!currentUser || currentUser.role === 'vendor' || currentUser.id?.includes('vendor'))
                ? 'demo-consumer-1'
                : currentUser.id,
            },
            body: JSON.stringify({
              orderId: id,
              listingName: order?.listingName,
              status: 'PICKED_UP',
            }),
          });
        } catch (err) {
          console.warn('[sync/order/status] skipped sync:', err);
        }
      },
      addListing: (listing) => {
        const hasManualCoords =
          typeof listing.latitude === 'number' &&
          typeof listing.longitude === 'number' &&
          !Number.isNaN(listing.latitude) &&
          !Number.isNaN(listing.longitude);
        const coords = hasManualCoords
          ? { latitude: listing.latitude!, longitude: listing.longitude! }
          : getCoordinatesForArea(listing.area, Date.now());

        const effectiveVendor = currentUser?.role === 'vendor' && currentUser.restaurantName
          ? currentUser.restaurantName
          : listing.vendor;

        const nextListing: FoodListing = {
          ...listing,
          vendor: effectiveVendor,
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          distance: 'Nearby',
          isMine: true,
        };
        save({
          listings: [nextListing, ...listingsRef.current],
          mode: 'vendor',
        });

        // Sync new listing to Drizzle PostgreSQL backend
        try {
          const apiUrl = getApiUrl();
          void fetch(`${apiUrl}/api/sync/listing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-marketplace-user-id': currentUser?.id || 'demo-vendor-1',
            },
            body: JSON.stringify({
              name: listing.name,
              description: listing.description || '',
              vendor: effectiveVendor,
              category: listing.category,
              price: Math.round(listing.price),
              originalPrice: Math.round(listing.originalPrice),
              quantity: Math.max(1, Math.round(listing.quantity)),
              pickupWindow: listing.pickupWindow || 'Today, 6:00 PM – 8:00 PM',
              area: listing.area || 'Bandra West',
              latitude: coords.latitude,
              longitude: coords.longitude,
              dietaryTags: listing.dietaryTags || [],
              dietTags: listing.dietTags || [],
              allergens: listing.allergens || [],
              mayContain: listing.mayContain || [],
              allergenInfoConfirmed: Boolean(listing.allergenInfoConfirmed),
              photo: listing.photo === 'bakery' ? 'bakery' : 'lunch',
            }),
          });
        } catch (err) {
          console.warn('[sync/listing] skipped sync:', err);
        }

        // Optional Supabase background sync
        supabase
          .from('listings')
          .insert({
            name: listing.name,
            description: listing.description,
            category: listing.category,
            price_inr: listing.price,
            original_price_inr: listing.originalPrice,
          })
          .then(() => {}, () => {});

        return nextListing.id;
      },
    }),
    [currentUser, favorites, followedVendors, isReady, listings, mode, orders, restaurants, save, storageError],
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace(): MarketplaceValue {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
}
