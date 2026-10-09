import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

export interface FoodListingItem {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  vendor: string;
  category: 'Bakery' | 'Cafe' | 'Meals';
  price: number;
  originalPrice: number;
  quantity: number;
  pickupWindow: string;
  area: string;
  distance: string;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  dietaryTags: string[];
  expiresAt: string;
  createdAt: string;
  discountPercent: number;
  photo: 'bakery' | 'lunch';
}

export interface OrderItem {
  id: string;
  listingId: string;
  vendorId: string;
  consumerUserId: string;
  listingName: string;
  vendor: string;
  pickupArea: string;
  pickupWindow: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice: number;
  totalPrice: number;
  status: 'RESERVED' | 'PREPARING' | 'READY' | 'PICKED_UP';
  createdAt: string;
  pickedUpAt: string | null;
}

// Default Mumbai demo listings
export const INITIAL_MUMBAI_LISTINGS: FoodListingItem[] = [
  {
    id: 'demo-1',
    vendorId: 'vendor-1',
    name: 'Artisan Sourdough & Croissants',
    description: 'Fresh morning bake surplus: 2 whole wheat sourdough loaves and flaky butter croissants.',
    vendor: 'Theobroma Patisserie',
    category: 'Bakery',
    price: 180,
    originalPrice: 450,
    quantity: 4,
    pickupWindow: 'Today, 8:00 PM – 9:30 PM',
    area: 'Bandra West',
    distance: '0.8 km',
    distanceKm: 0.8,
    latitude: 19.0596,
    longitude: 72.8295,
    dietaryTags: ['vegetarian'],
    expiresAt: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    discountPercent: 60,
    photo: 'bakery',
  },
  {
    id: 'demo-2',
    vendorId: 'vendor-2',
    name: 'Specialty Cold Brew & Sandwiches',
    description: 'Bottled single-origin cold brews and gourmet grilled vegetable paninis.',
    vendor: 'Subko Specialty Coffee',
    category: 'Cafe',
    price: 240,
    originalPrice: 580,
    quantity: 3,
    pickupWindow: 'Today, 7:30 PM – 9:00 PM',
    area: 'Ranwar Village, Bandra',
    distance: '1.2 km',
    distanceKm: 1.2,
    latitude: 19.0543,
    longitude: 72.8288,
    dietaryTags: ['vegetarian', 'vegan'],
    expiresAt: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    discountPercent: 59,
    photo: 'lunch',
  },
  {
    id: 'demo-3',
    vendorId: 'vendor-3',
    name: 'Regional Thali Surplus Box',
    description: 'Wholesome homestyle dinner boxes: paneer curry, dal tadka, rotis, and fragrant jeera rice.',
    vendor: 'Punjab Grill Express',
    category: 'Meals',
    price: 199,
    originalPrice: 499,
    quantity: 5,
    pickupWindow: 'Tonight, 9:30 PM – 11:00 PM',
    area: 'BKC, Mumbai',
    distance: '2.5 km',
    distanceKm: 2.5,
    latitude: 19.0657,
    longitude: 72.8687,
    dietaryTags: ['vegetarian', 'halal'],
    expiresAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    discountPercent: 60,
    photo: 'lunch',
  },
];

export function useListings() {
  const { selectedCategory, searchQuery, maxPrice, minDiscountPercent, selectedDietaryTags } =
    useAppStore();

  return useQuery({
    queryKey: [
      'listings',
      selectedCategory,
      searchQuery,
      maxPrice,
      minDiscountPercent,
      selectedDietaryTags,
    ],
    queryFn: async (): Promise<FoodListingItem[]> => {
      try {
        const { data, error } = await supabase
          .from('listings')
          .select('*, vendors(name, area, city)')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString());

        if (error || !data || data.length === 0) {
          // Use default high quality local items if Supabase is still connecting
          return applyFilters(INITIAL_MUMBAI_LISTINGS);
        }

        const mapped: FoodListingItem[] = data.map((item: any) => ({
          id: item.id,
          vendorId: item.vendor_id,
          name: item.name,
          description: item.description || '',
          vendor: item.vendors?.name || 'Local Kitchen',
          category: item.category,
          price: item.price_inr,
          originalPrice: item.original_price_inr,
          quantity: item.quantity,
          pickupWindow: item.pickup_window,
          area: item.area,
          distance: 'Nearby',
          distanceKm: 1.0,
          latitude: null,
          longitude: null,
          dietaryTags: item.dietary_tags || [],
          expiresAt: item.expires_at,
          createdAt: item.created_at,
          discountPercent: Math.round((1 - item.price_inr / item.original_price_inr) * 100),
          photo: item.category === 'Bakery' ? 'bakery' : 'lunch',
        }));

        return applyFilters(mapped);
      } catch {
        return applyFilters(INITIAL_MUMBAI_LISTINGS);
      }
    },
  });

  function applyFilters(list: FoodListingItem[]) {
    return list.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (maxPrice && item.price > maxPrice) return false;
      if (minDiscountPercent && item.discountPercent < minDiscountPercent) return false;
      if (
        searchQuery &&
        !`${item.name} ${item.vendor} ${item.area}`.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (
        selectedDietaryTags.length > 0 &&
        !selectedDietaryTags.some((tag) => item.dietaryTags.includes(tag))
      ) {
        return false;
      }
      return true;
    });
  }
}

// Realtime order status updates via Supabase
export function useRealtimeOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
