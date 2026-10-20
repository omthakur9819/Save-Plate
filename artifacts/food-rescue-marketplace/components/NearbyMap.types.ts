import { FoodListing } from '@/context/MarketplaceContext';

export interface NearbyMapProps {
  items: FoodListing[];
  onMarkerPress: (item: FoodListing) => void;
  center: { latitude: number; longitude: number } | null;
  showUserLocation: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedId?: string | null;
  onSelectMarker?: (item: FoodListing) => void;
  onLocateMe?: () => void;
}
