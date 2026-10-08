import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { AppMode, FoodCategory, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

const categories: Array<FoodCategory | 'All'> = ['All', 'Bakery', 'Cafe', 'Meals'];

function InsetHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? 67 : 0;
  return (
    <View style={{ paddingTop: Math.max(insets.top, webTop) + 10 }}>
      {children}
    </View>
  );
}

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, favorites, toggleFavorite, mode, setMode } = useMarketplace();
  const [category, setCategory] = useState<FoodCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);

  const availableListings = useMemo(
    () =>
      listings.filter((listing) => {
        const matchesCategory = category === 'All' || listing.category === category;
        const matchesSearch =
          !search.trim() ||
          `${listing.name} ${listing.vendor} ${listing.area}`
            .toLowerCase()
            .includes(search.trim().toLowerCase());
        const matchesSaved = !savedOnly || favorites.includes(listing.id);
        return listing.quantity > 0 && matchesCategory && matchesSearch && matchesSaved;
      }),
    [category, favorites, listings, savedOnly, search],
  );

  const openListing = (id: string) => {
    router.push({ pathname: '/listing/[id]', params: { id } });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 102 : Math.max(insets.bottom, 12) + 94 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <InsetHeader>
          <View style={styles.topLine}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>
                GOOD FOOD, SECOND CHANCE
              </Text>
              <Text style={[styles.location, { color: colors.foreground }]}>
                Mumbai <Feather name="chevron-down" size={17} color={colors.foreground} />
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const next: AppMode = mode === 'shopper' ? 'vendor' : 'shopper';
                setMode(next);
                Haptics.selectionAsync();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${mode === 'shopper' ? 'vendor' : 'shopper'} mode`}
              style={[styles.modeSwitch, { backgroundColor: colors.secondary }]}
              testID="mode-switch"
            >
              <Feather
                name={mode === 'shopper' ? 'shopping-bag' : 'briefcase'}
                size={14}
                color={colors.secondaryForeground}
              />
              <Text style={[styles.modeText, { color: colors.secondaryForeground }]}>
                {mode === 'shopper' ? 'Shopper' : 'Vendor'}
              </Text>
              <Feather name="repeat" size={13} color={colors.secondaryForeground} />
            </Pressable>
          </View>
        </InsetHeader>

        <View style={styles.headlineBlock}>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {mode === 'shopper' ? 'A good find.\nA little less waste.' : 'Your extra food\nhas a next stop.'}
          </Text>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            {mode === 'shopper'
              ? 'Local favorites, saved from the end of the day.'
              : 'Give today’s unsold favorites a second chance.'}
          </Text>
        </View>

        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Bakery bags, lunch, cafes..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            accessibilityLabel="Search food and vendors"
            testID="search-listings"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={savedOnly ? 'Show all food' : 'Show saved food'}
            onPress={() => setSavedOnly((value) => !value)}
            style={[styles.searchFilter, savedOnly && { backgroundColor: colors.accent }]}
            testID="saved-filter"
          >
            <Feather
              name="heart"
              size={16}
              color={savedOnly ? colors.primary : colors.secondaryForeground}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categories.map((item) => {
            const active = category === item;
            return (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.foreground : colors.card, borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`category-${item.toLowerCase()}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.background : colors.secondaryForeground }]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {savedOnly ? 'Saved for later' : 'Near you today'}
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {availableListings.length} fresh {availableListings.length === 1 ? 'find' : 'finds'} · pickup today
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/map')}
            accessibilityRole="button"
            style={styles.mapLink}
            testID="see-map"
          >
            <Feather name="map" size={15} color={colors.primary} />
            <Text style={[styles.mapLinkText, { color: colors.primary }]}>Map</Text>
          </Pressable>
        </View>

        {availableListings.length > 0 ? (
          availableListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorite={favorites.includes(listing.id)}
              onPress={() => openListing(listing.id)}
              onFavorite={() => {
                toggleFavorite(listing.id);
                Haptics.selectionAsync();
              }}
            />
          ))
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={savedOnly ? 'heart' : 'search'} size={25} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {savedOnly ? 'Nothing saved yet' : 'No matches just yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              {savedOnly
                ? 'Tap the heart on a food find to keep it close.'
                : 'Try another search or browse a different category.'}
            </Text>
          </View>
        )}

        <View style={[styles.impact, { backgroundColor: colors.accent }]}>
          <Feather name="sun" size={19} color={colors.secondaryForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.impactTitle, { color: colors.foreground }]}>A small save goes a long way</Text>
            <Text style={[styles.impactCopy, { color: colors.secondaryForeground }]}>
              Every pickup keeps good food in the neighborhood.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  location: { fontSize: 15, fontWeight: '700', marginTop: 5 },
  modeSwitch: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  modeText: { fontSize: 11, fontWeight: '700' },
  headlineBlock: { marginTop: 25, marginBottom: 18 },
  headline: { fontSize: 32, lineHeight: 37, letterSpacing: -0.9, fontWeight: '700' },
  subhead: { marginTop: 7, fontSize: 13, lineHeight: 19 },
  searchBox: { height: 52, borderRadius: 17, borderWidth: 1, paddingLeft: 15, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 8 },
  searchFilter: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingTop: 13, paddingBottom: 22 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9 },
  chipText: { fontSize: 11, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionCaption: { fontSize: 11, marginTop: 4 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  mapLinkText: { fontWeight: '700', fontSize: 12 },
  empty: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 26, marginBottom: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyCopy: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5, maxWidth: 245 },
  impact: { borderRadius: 19, padding: 15, marginTop: 2, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  impactTitle: { fontWeight: '700', fontSize: 12 },
  impactCopy: { fontSize: 11, marginTop: 3, lineHeight: 16 },
});
