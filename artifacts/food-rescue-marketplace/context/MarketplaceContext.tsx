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
  mode: AppMode;
  currentUser?: UserProfile | null;
}

interface MarketplaceValue extends PersistedState {
  isReady: boolean;
  storageError: boolean;
  currentUser: UserProfile | null;
  restaurants: RestaurantGroup[];
  login: (profile: UserProfile) => void;
  logout: () => void;
  register: (profile: Omit<UserProfile, 'id'>) => UserProfile;
  setMode: (mode: AppMode) => void;
  toggleFavorite: (id: string) => void;
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

const STORAGE_KEY = '@goodagain/marketplace-v3';
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
  const [mode, setMode] = useState<AppMode>('shopper');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(DEMO_SHOPPER);
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState(false);

  const listingsRef = useRef<FoodListing[]>(DEFAULT_LISTINGS);
  const ordersRef = useRef<PickupOrder[]>([]);
  const favoritesRef = useRef<string[]>([]);
  const modeRef = useRef<AppMode>('shopper');
  const userRef = useRef<UserProfile | null>(DEMO_SHOPPER);

  listingsRef.current = listings;
  ordersRef.current = orders;
  favoritesRef.current = favorites;
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

          listingsRef.current = localizedListings;
          ordersRef.current = localizedOrders;
          favoritesRef.current = saved.favorites ?? [];
          modeRef.current = saved.mode ?? 'shopper';
          userRef.current = saved.currentUser !== undefined ? saved.currentUser : DEMO_SHOPPER;

          setListings(localizedListings);
          setOrders(localizedOrders);
          setFavorites(saved.favorites ?? []);
          setMode(saved.mode ?? 'shopper');
          setCurrentUser(userRef.current);
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
    const nextMode = next.mode ?? modeRef.current;
    const nextUser = next.currentUser !== undefined ? next.currentUser : userRef.current;

    listingsRef.current = nextListings;
    ordersRef.current = nextOrders;
    favoritesRef.current = nextFavorites;
    modeRef.current = nextMode;
    userRef.current = nextUser;

    setListings(nextListings);
    setOrders(nextOrders);
    setFavorites(nextFavorites);
    setMode(nextMode);
    setCurrentUser(nextUser);

    const payload: PersistedState = {
      listings: nextListings,
      orders: nextOrders,
      favorites: nextFavorites,
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
      markCollected: (id) => {
        save({
          orders: ordersRef.current.map((order) =>
            order.id === id ? { ...order, collected: true } : order,
          ),
        });
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
    [currentUser, favorites, isReady, listings, mode, orders, restaurants, save, storageError],
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
