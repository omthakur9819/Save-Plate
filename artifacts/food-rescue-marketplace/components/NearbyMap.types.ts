import { FoodListing } from '@/context/MarketplaceContext';
import { RouteEstimate, TravelMode } from '@/lib/aStarRouting';

export interface NearbyMapProps {
  items: FoodListing[];
  onMarkerPress: (item: FoodListing) => void;
  center: { latitude: number; longitude: number } | null;
  showUserLocation: boolean;
  userLocation?: { latitude: number; longitude: number } | null;
  selectedId?: string | null;
  onSelectMarker?: (item: FoodListing) => void;
  onLocateMe?: () => void;
  routeDestination?: FoodListing | null;
  routeEstimate?: RouteEstimate | null;
  isRoutingLoading?: boolean;
  travelMode?: TravelMode;
  onChangeTravelMode?: (mode: TravelMode) => void;
  onStartRoute?: (item: FoodListing) => void;
  onClearRoute?: () => void;
}
