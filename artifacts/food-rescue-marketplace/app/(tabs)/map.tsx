import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NearbyMap from '@/components/NearbyMap';
import { ListingCard } from '@/components/ListingCard';
import {
  FoodCategory,
  FoodListing,
  formatRupees,
  ListingPhoto,
  useMarketplace,
} from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

const categories: Array<FoodCategory | 'All'> = ['All', 'Bakery', 'Cafe', 'Meals'];

const photos: Record<ListingPhoto, ImageSourcePropType> = {
  bakery: require('@/assets/images/listing-bakery.jpg'),
  lunch: require('@/assets/images/listing-lunch.jpg'),
};

export default function NearbyMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, favorites, toggleFavorite } = useMarketplace();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'All'>('All');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [myOffersOnly, setMyOffersOnly] = useState(false);

  const params = useLocalSearchParams<{ spotlight?: string }>();
  const [userCenter, setUserCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'located' | 'denied'>('idle');
  const [permission, requestPermission] = Location.useForegroundPermissions();

  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  // React to spotlight navigation parameter (e.g. from offer creation in My Food)
  useEffect(() => {
    if (params.spotlight) {
      const match = listings.find((item) => item.id === params.spotlight);
      if (match) {
        setSelectedListingId(match.id);
        setUserCenter({ latitude: match.latitude, longitude: match.longitude });
        setSearch('');
        setCategory('All');
        setSelectedArea('All');
        setMyOffersOnly(false);
      }
    }
  }, [params.spotlight, listings]);

  // Extract all distinct neighborhood areas
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    listings.forEach((item) => {
      if (item.area && item.quantity > 0) areas.add(item.area);
    });
    return ['All', ...Array.from(areas)];
  }, [listings]);

  const myOffersCount = useMemo(
    () => listings.filter((item) => item.isMine && item.quantity > 0).length,
    [listings],
  );

  const available = useMemo(() => {
    console.log('[NearbyMapScreen] map has total listings:', listings.length, 'myOffersCount:', myOffersCount);
    const query = search.trim().toLowerCase();
    return listings.filter((item) => {
      if (item.quantity <= 0) return false;

      // Filter by My Offers
      if (myOffersOnly && !item.isMine) return false;

      // Category filter
      if (category !== 'All' && item.category !== category) return false;

      // Area filter
      if (selectedArea !== 'All' && item.area.toLowerCase() !== selectedArea.toLowerCase()) {
        return false;
      }

      // Query text match (item name, vendor, area, description, category)
      if (query) {
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesVendor = item.vendor.toLowerCase().includes(query);
        const matchesArea = item.area.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        const matchesDesc = item.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesVendor && !matchesArea && !matchesCategory && !matchesDesc) {
          return false;
        }
      }

      return true;
    });
  }, [listings, search, category, selectedArea, myOffersOnly]);

  // Currently focused listing on the map
  const selectedListing = useMemo(() => {
    if (!selectedListingId) return null;
    return available.find((item) => item.id === selectedListingId) || null;
  }, [available, selectedListingId]);

  const openListing = (item: FoodListing) => {
    router.push({ pathname: '/listing/[id]', params: { id: item.id } });
  };

  const handleSelectMarker = (item: FoodListing) => {
    setSelectedListingId(item.id);
    setUserCenter({ latitude: item.latitude, longitude: item.longitude });
    Haptics.selectionAsync();
  };

  const handleSelectArea = (area: string) => {
    setSelectedArea(area);
    setSelectedListingId(null);
    Haptics.selectionAsync();

    if (area !== 'All') {
      const target = listings.find(
        (i) => i.area.toLowerCase() === area.toLowerCase() && i.quantity > 0,
      );
      if (target) {
        setUserCenter({ latitude: target.latitude, longitude: target.longitude });
      }
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setCategory('All');
    setSelectedArea('All');
    setMyOffersOnly(false);
    setSelectedListingId(null);
    Haptics.selectionAsync();
  };

  const locateMe = async () => {
    if (Platform.OS === 'web') {
      if (!navigator.geolocation) {
        Alert.alert('Location unavailable', 'Your browser does not provide location access.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setLocationStatus('located');
          setUserCenter({ latitude: coords.latitude, longitude: coords.longitude });
        },
        () => setLocationStatus('denied'),
        { enableHighAccuracy: true, timeout: 10000 },
      );
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setLocationStatus('denied');
        return;
      }
    }
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserCenter({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationStatus('located');
      Haptics.selectionAsync();
    } catch {
      Alert.alert('Could not get your location', 'Check your device location settings and try again.');
    }
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert('Settings unavailable', 'Open your device settings to allow location access.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingBottom: Platform.OS === 'web' ? 102 : Math.max(insets.bottom, 12) + 94,
        }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>FINDS AROUND YOU</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>A little closer</Text>
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              {available.length} {available.length === 1 ? 'spot' : 'spots'} available nearby
              {myOffersCount > 0 ? ` · ${myOffersCount} from your shop` : ''}
            </Text>
          </View>
          <Pressable
            onPress={locateMe}
            accessibilityRole="button"
            accessibilityLabel={locationStatus === 'located' ? 'Refresh my location' : 'Use my location'}
            style={[styles.locate, { backgroundColor: colors.accent }]}
            testID="locate-me"
          >
            <Feather name="crosshair" size={17} color={colors.secondaryForeground} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={17} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                if (selectedListingId) setSelectedListingId(null);
              }}
              placeholder="Search cafes, items, or areas..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
              accessibilityLabel="Search map for surplus food and cafes"
              testID="map-search-input"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setSelectedListingId(null);
                }}
                hitSlop={8}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search text"
                testID="map-search-clear"
              >
                <Feather name="x-circle" size={17} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category & Area Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}
        >
          {myOffersCount > 0 && (
            <Pressable
              onPress={() => {
                setMyOffersOnly((prev) => !prev);
                setSelectedListingId(null);
                Haptics.selectionAsync();
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: myOffersOnly ? '#2b8253' : colors.card,
                  borderColor: myOffersOnly ? '#2b8253' : '#2b8253',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Show only my posted offers"
            >
              <Feather name="star" size={12} color={myOffersOnly ? '#ffffff' : '#2b8253'} />
              <Text
                style={[
                  styles.filterChipText,
                  { color: myOffersOnly ? '#ffffff' : '#2b8253', fontWeight: '700' },
                ]}
              >
                My Food ({myOffersCount})
              </Text>
            </Pressable>
          )}

          {categories.map((cat) => {
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  setCategory(cat);
                  setSelectedListingId(null);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat}`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? colors.primaryForeground : colors.foreground, fontWeight: active ? '700' : '500' },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.chipDivider, { backgroundColor: colors.border }]} />

          {uniqueAreas.map((area) => {
            const active = selectedArea.toLowerCase() === area.toLowerCase();
            return (
              <Pressable
                key={area}
                onPress={() => handleSelectArea(area)}
                style={[
                  styles.filterChip,
                  { backgroundColor: active ? colors.secondary : colors.card, borderColor: active ? colors.secondaryForeground : colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filter by area ${area}`}
              >
                <Feather
                  name="map-pin"
                  size={12}
                  color={active ? colors.secondaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: active ? colors.secondaryForeground : colors.foreground,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {area === 'All' ? 'All Areas' : area}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {locationStatus === 'denied' &&
        Platform.OS !== 'web' &&
        permission?.status === 'denied' &&
        !permission.canAskAgain ? (
          <Pressable
            onPress={openSettings}
            style={[styles.permission, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.permissionText, { color: colors.secondaryForeground }]}>
              Location is off. Open Settings to turn it on.
            </Text>
            <Feather name="arrow-up-right" size={15} color={colors.secondaryForeground} />
          </Pressable>
        ) : null}

        {/* Map View */}
        <NearbyMap
          items={available}
          onMarkerPress={openListing}
          onSelectMarker={handleSelectMarker}
          selectedId={selectedListingId}
          center={userCenter}
          showUserLocation={!!permission?.granted}
        />

        {/* Map Hint / Legend */}
        <View style={styles.mapHint}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Tap any marker to inspect pickup details
          </Text>
          <View style={styles.neighborhood}>
            <Text style={[styles.neighborhoodText, { color: colors.secondaryForeground }]}>
              {selectedArea !== 'All' ? selectedArea : 'Mumbai'}
            </Text>
            <Feather name="chevron-down" size={13} color={colors.secondaryForeground} />
          </View>
        </View>

        {/* Selected Spot Spotlight Card */}
        {selectedListing && (
          <View
            style={[
              styles.spotlightCard,
              { backgroundColor: colors.card, borderColor: colors.primary },
            ]}
          >
            <Image
              source={selectedListing.imageUri ? { uri: selectedListing.imageUri } : photos[selectedListing.photo]}
              style={styles.spotlightImage}
              resizeMode="cover"
            />
            <View style={styles.spotlightContent}>
              <View style={styles.spotlightTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Text
                    style={[
                      styles.spotlightVendor,
                      { color: selectedListing.isMine ? '#2b8253' : colors.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedListing.vendor}
                  </Text>
                  {selectedListing.isMine && (
                    <View style={styles.spotlightMineBadge}>
                      <Text style={styles.spotlightMineBadgeText}>YOUR LIVE OFFER</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => setSelectedListingId(null)}
                  hitSlop={8}
                  accessibilityLabel="Close spotlight"
                >
                  <Feather name="x" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[styles.spotlightName, { color: colors.foreground }]} numberOfLines={1}>
                {selectedListing.name}
              </Text>
              <View style={styles.spotlightDetails}>
                <Text style={[styles.spotlightPrice, { color: colors.foreground }]}>
                  {formatRupees(selectedListing.price)}
                </Text>
                <Text style={[styles.spotlightOriginal, { color: colors.mutedForeground }]}>
                  {formatRupees(selectedListing.originalPrice)}
                </Text>
                <Text style={[styles.spotlightDot, { color: colors.mutedForeground }]}>·</Text>
                <Text style={[styles.spotlightArea, { color: colors.mutedForeground }]}>
                  {selectedListing.area}
                </Text>
              </View>
              <Pressable
                onPress={() => openListing(selectedListing)}
                style={[styles.spotlightButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel={`View ${selectedListing.name}`}
              >
                <Text style={[styles.spotlightButtonText, { color: colors.primaryForeground }]}>
                  View & Reserve
                </Text>
                <Feather name="arrow-right" size={13} color={colors.primaryForeground} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Results List Section */}
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.foreground }]}>
            {search.trim() ? `Matching "${search.trim()}"` : 'Around the corner'}
          </Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {available.length} {available.length === 1 ? 'find' : 'finds'}
          </Text>
        </View>

        {available.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
          >
            {available.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                horizontal
                favorite={favorites.includes(item.id)}
                onPress={() => openListing(item)}
                onFavorite={() => toggleFavorite(item.id)}
              />
            ))}
          </ScrollView>
        ) : (
          /* Empty Search Results */
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.secondary }]}>
              <Feather name="search" size={22} color={colors.secondaryForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No surplus bags found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              No spots match your search. Try adjusting the query, category, or area filter.
            </Text>
            <Pressable
              onPress={clearAllFilters}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Feather name="rotate-ccw" size={14} color={colors.primaryForeground} />
              <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                Clear filters
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.5, marginTop: 5 },
  caption: { fontSize: 12, marginTop: 4 },
  locate: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  filterChips: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  chipDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
  },
  mapHint: {
    paddingHorizontal: 21,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  hintText: { flex: 1, fontSize: 10 },
  neighborhood: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  neighborhoodText: { fontSize: 10, fontWeight: '700' },
  spotlightCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  spotlightImage: {
    width: 84,
    height: 84,
    borderRadius: 12,
  },
  spotlightContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  spotlightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotlightVendor: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  spotlightMineBadge: {
    backgroundColor: '#2b8253',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  spotlightMineBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spotlightName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  spotlightDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  spotlightPrice: {
    fontSize: 13,
    fontWeight: '800',
  },
  spotlightOriginal: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  spotlightDot: {
    fontSize: 11,
  },
  spotlightArea: {
    fontSize: 11,
  },
  spotlightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  spotlightButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listTitle: { fontSize: 18, fontWeight: '700' },
  count: { fontSize: 11 },
  cards: { paddingHorizontal: 16 },
  emptyCard: {
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permission: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionText: { fontSize: 11, fontWeight: '600' },
});

