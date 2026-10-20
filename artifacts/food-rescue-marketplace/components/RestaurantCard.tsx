import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { formatRupees, RestaurantGroup } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

export function RestaurantCard({ restaurant }: { restaurant: RestaurantGroup }) {
  const colors = useColors();

  const handleOpenRestaurant = () => {
    router.push({
      pathname: '/restaurant/[id]',
      params: { id: restaurant.id },
    });
  };

  return (
    <Pressable
      onPress={handleOpenRestaurant}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`View ${restaurant.name} with ${restaurant.dishes.length} dishes`}
    >
      {/* Restaurant Header */}
      <View style={styles.header}>
        {restaurant.coverImage ? (
          <Image source={{ uri: restaurant.coverImage }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.secondary }]}>
            <Feather name="coffee" size={24} color={colors.primary} />
          </View>
        )}

        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <View style={[styles.ratingPill, { backgroundColor: '#FEF3C7' }]}>
              <Feather name="star" size={11} color="#D97706" />
              <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {restaurant.area} · {restaurant.distance} · {restaurant.category}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.dishCountBadge, { backgroundColor: colors.secondary }]}>
              <Feather name="check-circle" size={12} color={colors.primary} />
              <Text style={[styles.dishCountText, { color: colors.foreground }]}>
                {restaurant.dishes.length} {restaurant.dishes.length === 1 ? 'surplus item' : 'surplus items'}
              </Text>
            </View>
            <Text style={[styles.timingText, { color: colors.mutedForeground }]}>
              {restaurant.pickupWindow}
            </Text>
          </View>
        </View>
      </View>

      {/* Dishes preview row */}
      <View style={[styles.dishesSection, { borderColor: colors.border }]}>
        <Text style={[styles.dishesHeading, { color: colors.mutedForeground }]}>
          AVAILABLE SURPLUS TODAY:
        </Text>
        <View style={styles.dishesList}>
          {restaurant.dishes.map((dish) => (
            <View
              key={dish.id}
              style={[styles.dishPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <View style={styles.dishPillContent}>
                <Text style={[styles.dishName, { color: colors.foreground }]} numberOfLines={1}>
                  {dish.name}
                </Text>
                <View style={styles.dishPrices}>
                  <Text style={[styles.rescuePrice, { color: colors.primary }]}>
                    {formatRupees(dish.price)}
                  </Text>
                  <Text style={[styles.originalPrice, { color: colors.mutedForeground }]}>
                    {formatRupees(dish.originalPrice)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Action Footer */}
      <View style={[styles.footer, { borderColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.primary }]}>
          View all {restaurant.dishes.length} items & rescue
        </Text>
        <Feather name="arrow-right" size={15} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  dishCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dishCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timingText: {
    fontSize: 11,
  },
  dishesSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  dishesHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dishesList: {
    gap: 6,
  },
  dishPill: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dishPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dishName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  dishPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rescuePrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
