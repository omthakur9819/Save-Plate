import { create } from 'zustand';

export type FoodCategory = 'All' | 'Bakery' | 'Cafe' | 'Meals';
export type AppMode = 'shopper' | 'vendor';

export interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

interface AppState {
  // Mode: Shopper vs Vendor
  mode: AppMode;
  setMode: (mode: AppMode) => void;

  // Location (Default: Mumbai Bandra / Bandra West)
  location: UserLocation;
  setLocation: (loc: UserLocation) => void;

  // Search & Filter state
  selectedCategory: FoodCategory;
  setSelectedCategory: (cat: FoodCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  maxPrice: number | null;
  setMaxPrice: (price: number | null) => void;
  minDiscountPercent: number | null;
  setMinDiscountPercent: (discount: number | null) => void;
  selectedDietaryTags: string[];
  toggleDietaryTag: (tag: string) => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (id: string) => void;

  // Selected Listing for Bottom Sheet / Map Preview
  selectedListingId: string | null;
  setSelectedListingId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'shopper',
  setMode: (mode) => set({ mode }),

  location: {
    latitude: 19.0596,
    longitude: 72.8295,
    address: 'Bandra West, Mumbai',
  },
  setLocation: (location) => set({ location }),

  selectedCategory: 'All',
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  maxPrice: null,
  setMaxPrice: (maxPrice) => set({ maxPrice }),

  minDiscountPercent: null,
  setMinDiscountPercent: (minDiscountPercent) => set({ minDiscountPercent }),

  selectedDietaryTags: [],
  toggleDietaryTag: (tag) =>
    set((state) => {
      const exists = state.selectedDietaryTags.includes(tag);
      return {
        selectedDietaryTags: exists
          ? state.selectedDietaryTags.filter((t) => t !== tag)
          : [...state.selectedDietaryTags, tag],
      };
    }),

  favorites: [],
  toggleFavorite: (id) =>
    set((state) => {
      const exists = state.favorites.includes(id);
      return {
        favorites: exists
          ? state.favorites.filter((favId) => favId !== id)
          : [...state.favorites, id],
      };
    }),

  selectedListingId: null,
  setSelectedListingId: (selectedListingId) => set({ selectedListingId }),
}));
