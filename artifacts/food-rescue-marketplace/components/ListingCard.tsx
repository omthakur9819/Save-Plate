import { Feather } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { FoodListing, formatRupees, ListingPhoto } from '@/context/MarketplaceContext';

const photos: Record<ListingPhoto, ImageSourcePropType> = {
  bakery: require('@/assets/images/listing-bakery.jpg'),
  lunch: require('@/assets/images/listing-lunch.jpg'),
};

interface ListingCardProps {
  listing: FoodListing;
  favorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  horizontal?: boolean;
  warningNotice?: string;
}

export function ListingCard({
  listing,
  favorite,
  onPress,
  onFavorite,
  horizontal = false,
  warningNotice,
}: ListingCardProps) {
  const colors = useColors();
  const discount = Math.round(
    (1 - listing.price / listing.originalPrice) * 100,
  );

  return (
    <View
      style={[
        styles.card,
        horizontal && styles.horizontal,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      testID={`listing-card-${listing.id}`}
    >
      <View style={styles.imageWrap}>
        <Pressable
          accessibilityRole="button"
      accessibilityLabel={`${listing.name}, ${formatRupees(listing.price)}, from ${listing.vendor}`}
          onPress={onPress}
          style={({ pressed }) => [styles.imageTap, pressed && styles.pressed]}
        >
          <Image
            source={listing.imageUri ? { uri: listing.imageUri } : photos[listing.photo]}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.discount}>
            <Text style={styles.discountText}>{discount}% off</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Remove from saved' : 'Save listing'}
          onPress={onFavorite}
          hitSlop={10}
          style={styles.heart}
          testID={`favorite-${listing.id}`}
        >
          <Feather
            name={favorite ? 'heart' : 'heart'}
            size={17}
            color={favorite ? colors.primary : '#315644'}
          />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${listing.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>
            {listing.name}
          </Text>
          <Text style={[styles.price, { color: colors.foreground }]}>{formatRupees(listing.price)}</Text>
        </View>
        <Text style={[styles.vendor, { color: colors.mutedForeground }]}>
          {listing.vendor}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={12} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {listing.distance}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              Pickup by {listing.pickupWindow.split(', ').at(-1)}
            </Text>
          </View>
        </View>

        {/* Dietary & Allergen Badges */}
        <View style={styles.tagBadgeRow}>
          {listing.allergenInfoConfirmed ? (
            <>
              {(listing.dietaryTags || listing.dietTags || []).map((t) => {
                const lower = t.toLowerCase();
                const label =
                  lower === 'veg' || lower === 'vegetarian'
                    ? '🌱 Veg'
                    : lower === 'vegan'
                      ? '🌿 Vegan'
                      : lower === 'egg_free' || lower === 'eggless'
                        ? '🥚 Egg-Free'
                        : lower === 'jain'
                          ? '✨ Jain'
                          : lower === 'halal'
                            ? '☪️ Halal'
                            : lower === 'dairy-free' || lower === 'dairy_free'
                              ? '🥛 Dairy-Free'
                              : lower === 'gluten-free' || lower === 'gluten_free'
                                ? '🌾 Gluten-Free'
                                : t;
                return (
                  <View key={`card-diet-${t}`} style={styles.dietBadge}>
                    <Text style={styles.dietBadgeText}>{label}</Text>
                  </View>
                );
              })}
              {listing.allergens && listing.allergens.length > 0 && (
                <View style={styles.allergenAlertBadge}>
                  <Text style={styles.allergenAlertText} numberOfLines={1}>
                    Contains: {listing.allergens
                      .map((a) => {
                        const map: Record<string, string> = {
                          milk: 'Milk',
                          egg: 'Egg',
                          peanuts: 'Peanuts',
                          tree_nuts: 'Tree Nuts',
                          gluten: 'Gluten',
                          soy: 'Soy',
                          fish: 'Fish',
                          shellfish: 'Shellfish',
                          sesame: 'Sesame',
                          mustard: 'Mustard',
                        };
                        return map[a.toLowerCase()] || a.replace(/_/g, ' ');
                      })
                      .join(', ')}
                  </Text>
                </View>
              )}
              {warningNotice ? (
                <View style={styles.mayContainAlertBadge}>
                  <Text style={styles.mayContainAlertText} numberOfLines={1}>
                    ⚠️ {warningNotice}
                  </Text>
                </View>
              ) : listing.mayContain && listing.mayContain.length > 0 ? (
                <View style={styles.mayContainAlertBadge}>
                  <Text style={styles.mayContainAlertText} numberOfLines={1}>
                    Traces: {listing.mayContain
                      .map((a) => {
                        const map: Record<string, string> = {
                          milk: 'Milk',
                          egg: 'Egg',
                          peanuts: 'Peanuts',
                          tree_nuts: 'Tree Nuts',
                          gluten: 'Gluten',
                          soy: 'Soy',
                          fish: 'Fish',
                          shellfish: 'Shellfish',
                          sesame: 'Sesame',
                          mustard: 'Mustard',
                        };
                        return map[a.toLowerCase()] || a.replace(/_/g, ' ');
                      })
                      .join(', ')}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.unconfirmedBadge}>
              <Text style={styles.unconfirmedBadgeText}>Allergen info not verified</Text>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>{formatRupees(listing.originalPrice)}</Text>
          <Text style={[styles.portions, { color: colors.secondaryForeground }]}>
            {listing.quantity} {listing.quantity === 1 ? 'left' : 'left'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
  },
  horizontal: {
    width: 284,
    marginBottom: 0,
    marginRight: 12,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  imageWrap: { height: 172, position: 'relative' },
  imageTap: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  discount: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: '#315644',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heart: {
    position: 'absolute',
    right: 11,
    top: 11,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '800' },
  vendor: { fontSize: 12, marginTop: 3 },
  meta: { flexDirection: 'row', gap: 14, marginTop: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11 },
  footer: {
    marginTop: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  oldPrice: { fontSize: 12, textDecorationLine: 'line-through' },
  portions: { fontSize: 11, fontWeight: '700' },
  tagBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  dietBadge: {
    backgroundColor: '#eaf3ec',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bedbc4',
  },
  dietBadgeText: {
    color: '#1e5436',
    fontSize: 10,
    fontWeight: '700',
  },
  allergenAlertBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    maxWidth: 200,
  },
  allergenAlertText: {
    color: '#b91c1c',
    fontSize: 10,
    fontWeight: '600',
  },
  mayContainAlertBadge: {
    backgroundColor: '#fffbeb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    maxWidth: 200,
  },
  mayContainAlertText: {
    color: '#b45309',
    fontSize: 10,
    fontWeight: '600',
  },
  unconfirmedBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  unconfirmedBadgeText: {
    color: '#6b7280',
    fontSize: 10,
    fontWeight: '500',
  },
});
