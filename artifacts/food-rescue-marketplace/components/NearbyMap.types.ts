import { FoodListing } from '@/context/MarketplaceContext';

export interface NearbyMapProps {
  items: FoodListing[];
  onMarkerPress: (item: FoodListing) => void;
  center: { latitude: number; longitude: number } | null;
  showUserLocation: boolean;
  selectedId?: string | null;
  onSelectMarker?: (item: FoodListing) => void;
}
