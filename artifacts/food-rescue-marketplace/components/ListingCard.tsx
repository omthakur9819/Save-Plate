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
}

export function ListingCard({
  listing,
  favorite,
  onPress,
  onFavorite,
  horizontal = false,
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
          <Image source={photos[listing.photo]} style={styles.image} resizeMode="cover" />
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
});
