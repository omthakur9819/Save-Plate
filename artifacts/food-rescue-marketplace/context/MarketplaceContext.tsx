import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
  placeOrder: (listing: FoodListing, quantity?: number) => Promise<boolean>;
  markCollected: (id: string) => void;
  addListing: (
    listing: Omit<FoodListing, 'id' | 'latitude' | 'longitude' | 'isMine'>,
  ) => void;
}

const STORAGE_KEY = '@goodagain/marketplace-v1';
const OLD_DEMO_AREAS = new Set([
  'Hayes Valley',
  'Lower Haight',
  'Civic Center',
  'Duboce Triangle',
]);
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
            if (item.isMine && OLD_DEMO_AREAS.has(item.area)) {
              return {
                ...item,
                area: 'Bandra West',
                latitude: 19.0593,
                longitude: 72.829,
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
          setListings(localizedListings);
          setOrders(localizedOrders);
          setFavorites(saved.favorites ?? []);
          setMode(saved.mode ?? 'shopper');
        }
      })
      .catch(() => {
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
    (next: PersistedState) => {
      setListings(next.listings);
      setOrders(next.orders);
      setFavorites(next.favorites);
      setMode(next.mode);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() =>
        setStorageError(true),
      );
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
      setMode: (nextMode) => save({ listings, orders, favorites, mode: nextMode }),
      toggleFavorite: (id) => {
        const nextFavorites = favorites.includes(id)
          ? favorites.filter((favoriteId) => favoriteId !== id)
          : [...favorites, id];
        save({ listings, orders, favorites: nextFavorites, mode });
      },
      placeOrder: async (listing, quantity = 1) => {
        const current = listings.find((item) => item.id === listing.id);
        if (!current || current.quantity < quantity || quantity < 1) return false;
        const order: PickupOrder = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          listingId: current.id,
          listingName: current.name,
          vendor: current.vendor,
          quantity,
          total: current.price * quantity,
          pickupWindow: current.pickupWindow,
          area: current.area,
          placedAt: new Date().toISOString(),
          collected: false,
        };
        const nextListings = listings.map((item) =>
          item.id === current.id
            ? { ...item, quantity: item.quantity - quantity }
            : item,
        );
        save({ listings: nextListings, orders: [order, ...orders], favorites, mode });
        return true;
      },
      markCollected: (id) => {
        save({
          listings,
          orders: orders.map((order) =>
            order.id === id ? { ...order, collected: true } : order,
          ),
          favorites,
          mode,
        });
      },
      addListing: (listing) => {
        const nextListing: FoodListing = {
          ...listing,
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          latitude: 19.0593,
          longitude: 72.829,
          distance: 'Nearby',
          isMine: true,
        };
        save({
          listings: [nextListing, ...listings],
          orders,
          favorites,
          mode: 'vendor',
        });
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
