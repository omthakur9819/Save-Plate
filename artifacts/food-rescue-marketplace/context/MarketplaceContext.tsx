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

interface PersistedState {
  listings: FoodListing[];
  orders: PickupOrder[];
  favorites: string[];
  mode: AppMode;
}

interface MarketplaceValue extends PersistedState {
  isReady: boolean;
  storageError: boolean;
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

const STORAGE_KEY = '@goodagain/marketplace-v1';
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
] as const;

export function getCoordinatesForArea(
  area: string,
  seed: string | number = 0,
): { latitude: number; longitude: number } {
  const clean = (area || '').trim().toLowerCase();
  let base = { latitude: 19.0596, longitude: 72.8295 };

  // 1. Direct key match
  if (MUMBAI_NEIGHBORHOOD_COORDS[clean]) {
    base = MUMBAI_NEIGHBORHOOD_COORDS[clean];
  } else {
    // 2. Substring match
    for (const [key, coords] of Object.entries(MUMBAI_NEIGHBORHOOD_COORDS)) {
      if (clean.includes(key) || key.includes(clean)) {
        base = coords;
        break;
      }
    }
  }

  // Exact coordinates requested (default when seed is 0 or undefined)
  if (!seed || seed === 0) {
    return { latitude: base.latitude, longitude: base.longitude };
  }

  // Small micro-offset (~50m) only when explicitly seeding distinct mock listings
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
const DEFAULT_LISTINGS: FoodListing[] = [
  {
    id: 'seed-bakery',
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
    latitude: 19.0593,
    longitude: 72.829,
    description: 'A happy mix of today’s extra pastries and bread. Expect a little surprise in every bag.',
  },
  {
    id: 'seed-lunch',
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
    latitude: 19.067,
    longitude: 72.832,
    description: 'A fresh seasonal grain bowl with roasted vegetables, herbs and a little loaf of house bread.',
  },
  {
    id: 'seed-pastry',
    name: 'Assorted pastry box',
    vendor: 'Bandra Bread Room',
    category: 'Bakery',
    price: 199,
    originalPrice: 549,
    quantity: 2,
    pickupWindow: 'Today, 6:00–7:00 PM',
    area: 'Pali Hill',
    distance: '1.2 km',
    photo: 'bakery',
    latitude: 19.062,
    longitude: 72.825,
    description: 'Four assorted pastries from the counter, packed up fresh just before closing.',
  },
  {
    id: 'seed-supper',
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
    latitude: 19.053,
    longitude: 72.836,
    description: 'A hearty home-style tiffin with seasonal sabzi, rice and fresh rotis.',
  },
];

const MarketplaceContext = createContext<MarketplaceValue | null>(null);

export function MarketplaceProvider({ children }: PropsWithChildren) {
  const [listings, setListings] = useState<FoodListing[]>(DEFAULT_LISTINGS);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mode, setMode] = useState<AppMode>('shopper');
  const [isReady, setIsReady] = useState(false);
  const [storageError, setStorageError] = useState(false);

  const listingsRef = useRef<FoodListing[]>(DEFAULT_LISTINGS);
  const ordersRef = useRef<PickupOrder[]>([]);
  const favoritesRef = useRef<string[]>([]);
  const modeRef = useRef<AppMode>('shopper');

  listingsRef.current = listings;
  ordersRef.current = orders;
  favoritesRef.current = favorites;
  modeRef.current = mode;

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          const saved = JSON.parse(raw) as Partial<PersistedState>;
          const storedListings = saved.listings ?? DEFAULT_LISTINGS;
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
          console.log('[MarketplaceContext] loaded from storage, listings count:', localizedListings.length);
          listingsRef.current = localizedListings;
          ordersRef.current = localizedOrders;
          favoritesRef.current = saved.favorites ?? [];
          modeRef.current = saved.mode ?? 'shopper';

          setListings(localizedListings);
          setOrders(localizedOrders);
          setFavorites(saved.favorites ?? []);
          setMode(saved.mode ?? 'shopper');
        } else {
          console.log('[MarketplaceContext] storage was empty, using defaults');
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

  const save = useCallback(
    (next: Partial<PersistedState>) => {
      const nextListings = next.listings ?? listingsRef.current;
      const nextOrders = next.orders ?? ordersRef.current;
      const nextFavorites = next.favorites ?? favoritesRef.current;
      const nextMode = next.mode ?? modeRef.current;

      console.log('[MarketplaceContext] saving state, listings count:', nextListings.length, 'mode:', nextMode);

      listingsRef.current = nextListings;
      ordersRef.current = nextOrders;
      favoritesRef.current = nextFavorites;
      modeRef.current = nextMode;

      setListings(nextListings);
      setOrders(nextOrders);
      setFavorites(nextFavorites);
      setMode(nextMode);

      const payload: PersistedState = {
        listings: nextListings,
        orders: nextOrders,
        favorites: nextFavorites,
        mode: nextMode,
      };

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
        .then(() => {
          console.log('[MarketplaceContext] saved successfully to AsyncStorage, count:', nextListings.length);
        })
        .catch((err) => {
          console.error('[MarketplaceContext] failed saving to AsyncStorage:', err);
          setStorageError(true);
        });
    },
    [],
  );

  const value = useMemo<MarketplaceValue>(
    () => ({
      listings,
      orders,
      favorites,
      mode,
      isReady,
      storageError,
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
        const nextListing: FoodListing = {
          ...listing,
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          distance: 'Nearby',
          isMine: true,
        };
        console.log('[MarketplaceContext] addListing added:', nextListing.name, nextListing.id, 'total count:', listingsRef.current.length + 1);
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
            quantity: listing.quantity,
            pickup_window: listing.pickupWindow,
            area: listing.area,
            is_active: true,
            expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
          })
          .then(() => {}, () => {});

        return nextListing.id;
      },
    }),
    [favorites, isReady, listings, mode, orders, save, storageError],
  );

  return (
    <MarketplaceContext.Provider value={value}>
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const value = useContext(MarketplaceContext);
  if (!value) {
    throw new Error('useMarketplace must be used inside MarketplaceProvider.');
  }
  return value;
}
