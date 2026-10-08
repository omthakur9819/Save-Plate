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
const DEFAULT_LISTINGS: FoodListing[] = [
  {
    id: 'seed-bakery',
    name: 'The little bakery bag',
    vendor: 'Sunday Bakehouse',
    category: 'Bakery',
    price: 5,
    originalPrice: 16,
    quantity: 4,
    pickupWindow: 'Today, 5:30–6:30 PM',
    area: 'Hayes Valley',
    distance: '0.4 mi',
    photo: 'bakery',
    latitude: 37.776,
    longitude: -122.424,
    description:
      'A happy mix of today’s extra pastries and bread. Expect a little surprise in every bag.',
  },
  {
    id: 'seed-lunch',
    name: 'Harvest lunch bowl',
    vendor: 'Olive & Grain Cafe',
    category: 'Cafe',
    price: 7,
    originalPrice: 18,
    quantity: 3,
    pickupWindow: 'Today, 4:00–5:00 PM',
    area: 'Lower Haight',
    distance: '0.8 mi',
    photo: 'lunch',
    latitude: 37.772,
    longitude: -122.431,
    description:
      'A fresh seasonal grain bowl with roasted vegetables, herbs and a little loaf of house bread.',
  },
  {
    id: 'seed-pastry',
    name: 'Pastry box for two',
    vendor: 'Sunday Bakehouse',
    category: 'Bakery',
    price: 6,
    originalPrice: 20,
    quantity: 2,
    pickupWindow: 'Today, 6:00–7:00 PM',
    area: 'Civic Center',
    distance: '1.1 mi',
    photo: 'bakery',
    latitude: 37.779,
    longitude: -122.416,
    description:
      'Four assorted pastries from the counter, packed up fresh just before closing.',
  },
  {
    id: 'seed-supper',
    name: 'Tonight’s supper plate',
    vendor: 'Olive & Grain Cafe',
    category: 'Meals',
    price: 8,
    originalPrice: 21,
    quantity: 2,
    pickupWindow: 'Today, 6:30–7:30 PM',
    area: 'Duboce Triangle',
    distance: '1.3 mi',
    photo: 'lunch',
    latitude: 37.768,
    longitude: -122.425,
    description:
      'A generous chef-made plate with seasonal sides. Vegetarian options available today.',
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
          setListings(saved.listings ?? DEFAULT_LISTINGS);
          setOrders(saved.orders ?? []);
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
          latitude: 37.775,
          longitude: -122.42,
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
