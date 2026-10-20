import React, { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { formatRupees, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

export default function RestaurantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { restaurants, favorites, toggleFavorite } = useMarketplace();

  const restaurant = useMemo(() => {
    return (
      restaurants.find((r) => r.id === id) ||
      restaurants.find((r) => r.name.toLowerCase() === (id || '').toLowerCase()) ||
      restaurants[0]
    );
  }, [id, restaurants]);

  const lowestPrice = useMemo(() => {
    if (!restaurant?.dishes.length) return 0;
    return Math.min(...restaurant.dishes.map((d) => d.price));
  }, [restaurant]);

  if (!restaurant) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.foreground }}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 10),
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Back to explore"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.navTitleContainer}>
          <Text style={[styles.navTitle, { color: colors.foreground }]} numberOfLines={1}>
            {restaurant.name}
          </Text>
          <Text style={[styles.navSubtitle, { color: colors.mutedForeground }]}>
            {restaurant.dishes.length} dishes available today
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 90 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Restaurant Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {restaurant.coverImage && (
            <Image source={{ uri: restaurant.coverImage }} style={styles.heroImage} />
          )}

          <View style={styles.heroBody}>
            <View style={styles.nameRow}>
              <Text style={[styles.restaurantTitle, { color: colors.foreground }]}>
                {restaurant.name}
              </Text>
              <View style={[styles.verifiedBadge, { backgroundColor: '#DCFCE7' }]}>
                <Feather name="check" size={12} color="#166534" />
                <Text style={styles.verifiedText}>Verified Rescue Partner</Text>
              </View>
            </View>

            <Text style={[styles.cuisineArea, { color: colors.mutedForeground }]}>
              {restaurant.category} · {restaurant.area} · {restaurant.distance} away
            </Text>

            {/* Highlights row */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: colors.secondary }]}>
                <Feather name="star" size={14} color="#D97706" />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {restaurant.rating.toFixed(1)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  ({restaurant.ratingCount} reviews)
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.secondary }]}>
                <Feather name="clock" size={14} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  Pickup Window
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {restaurant.pickupWindow}
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.secondary }]}>
                <Feather name="tag" size={14} color="#059669" />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  From {formatRupees(lowestPrice)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Up to 65% OFF
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Available Surplus Menu */}
        <View style={styles.menuHeader}>
          <Text style={[styles.menuTitle, { color: colors.foreground }]}>
            Today’s Surplus Menu ({restaurant.dishes.length})
          </Text>
          <Text style={[styles.menuSubtitle, { color: colors.mutedForeground }]}>
            All dishes are freshly prepared today and reserved for pickup to avoid waste.
          </Text>
        </View>

        {restaurant.dishes.map((dish) => (
          <ListingCard
            key={dish.id}
            listing={dish}
            favorite={favorites.includes(dish.id)}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: dish.id } })}
            onFavorite={() => toggleFavorite(dish.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    padding: 18,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#CBD5E1',
  },
  heroBody: {
    padding: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  restaurantTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  cuisineArea: {
    fontSize: 13,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  menuHeader: {
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
});
