import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodListing, ListingPhoto, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

const photos: Record<ListingPhoto, ImageSourcePropType> = {
  bakery: require('@/assets/images/listing-bakery.jpg'),
  lunch: require('@/assets/images/listing-lunch.jpg'),
};

export default function ListingDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { listings, favorites, toggleFavorite, placeOrder } = useMarketplace();
  const listing = listings.find((item) => item.id === id);
  const favorite = !!listing && favorites.includes(listing.id);
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const reserve = async (item: FoodListing) => {
    const reserved = await placeOrder(item);
    if (!reserved) {
      Alert.alert('This one just went', 'There are no portions left. Browse other nearby finds.');
      router.back();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'It’s yours!',
      `Your pickup is reserved at ${item.vendor}. Find your pickup code in Pickups.`,
      [
        {
          text: 'View pickup details',
          onPress: () => router.replace('/orders'),
        },
      ],
    );
  };

  if (!listing) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background, paddingTop: topInset + 24 }]}>
        <Pressable onPress={() => router.back()} style={styles.backOnly} accessibilityRole="button">
          <Feather name="arrow-left" size={21} color={colors.foreground} />
        </Pressable>
        <Feather name="search" size={27} color={colors.primary} />
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>This food find has gone</Text>
        <Text style={[styles.notFoundCopy, { color: colors.mutedForeground }]}>It may have been picked up already.</Text>
      </View>
    );
  }

  const discount = Math.round((1 - listing.price / listing.originalPrice) * 100);
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 120 : Math.max(insets.bottom, 12) + 115 }}
      >
        <View style={styles.hero}>
          <Image source={photos[listing.photo]} style={styles.heroImage} />
          <View style={[styles.heroTop, { paddingTop: topInset + 5 }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="listing-back"
            >
              <Feather name="arrow-left" size={19} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => toggleFavorite(listing.id)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Remove from saved' : 'Save listing'}
              testID="listing-favorite"
            >
              <Feather name="heart" size={19} color={favorite ? colors.primary : colors.foreground} />
            </Pressable>
          </View>
          <View style={[styles.discountPill, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.discountText, { color: colors.background }]}>{discount}% off today</Text>
          </View>
        </View>
        <View style={styles.details}>
          <View style={styles.categoryLine}>
            <Text style={[styles.category, { color: colors.secondaryForeground }]}>{listing.category.toUpperCase()}</Text>
            <View style={styles.stock}>
              <View style={[styles.stockDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.stockText, { color: colors.secondaryForeground }]}>
                {listing.quantity} {listing.quantity === 1 ? 'left' : 'left'}
              </Text>
            </View>
          </View>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{listing.name}</Text>
            <Text style={[styles.price, { color: colors.foreground }]}>${listing.price}</Text>
          </View>
          <Text style={[styles.vendor, { color: colors.mutedForeground }]}>
            From {listing.vendor} · <Text style={{ textDecorationLine: 'line-through' }}>${listing.originalPrice}</Text>
          </Text>
          <View style={[styles.rule, { borderColor: colors.border }]} />
          <Text style={[styles.description, { color: colors.foreground }]}>{listing.description}</Text>

          <View style={[styles.pickupCard, { backgroundColor: colors.accent }]}>
            <View style={[styles.pickupIcon, { backgroundColor: colors.card }]}>
              <Feather name="clock" size={17} color={colors.secondaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickupLabel, { color: colors.secondaryForeground }]}>PICKUP WINDOW</Text>
              <Text style={[styles.pickupTime, { color: colors.foreground }]}>{listing.pickupWindow}</Text>
            </View>
          </View>
          <View style={styles.placeLine}>
            <View style={[styles.placeIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="map-pin" size={15} color={colors.secondaryForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.placeName, { color: colors.foreground }]}>{listing.area}</Text>
              <Text style={[styles.placeMeta, { color: colors.mutedForeground }]}>{listing.distance} away · Pay when you pick up</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </View>

          <View style={[styles.wasteNote, { borderColor: colors.border }]}>
            <Feather name="heart" size={15} color={colors.primary} />
            <Text style={[styles.wasteText, { color: colors.secondaryForeground }]}>
              Great food, given another chance. Thanks for being part of it.
            </Text>
          </View>
        </View>
      </ScrollView>
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            paddingBottom: Platform.OS === 'web' ? 34 : Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View>
          <Text style={[styles.bottomPrice, { color: colors.foreground }]}>${listing.price}</Text>
          <Text style={[styles.bottomMeta, { color: colors.mutedForeground }]}>pay at pickup</Text>
        </View>
        <Pressable
          onPress={() => reserve(listing)}
          disabled={listing.quantity < 1}
          style={({ pressed }) => [
            styles.reserveButton,
            { backgroundColor: listing.quantity > 0 ? colors.primary : colors.muted },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          testID="reserve-pickup"
        >
          <Text style={[styles.reserveText, { color: listing.quantity > 0 ? colors.primaryForeground : colors.mutedForeground }]}>
            {listing.quantity > 0 ? 'Reserve a pickup' : 'All picked up'}
          </Text>
          {listing.quantity > 0 ? <Feather name="arrow-right" size={16} color={colors.primaryForeground} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: 325, position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroTop: { position: 'absolute', left: 18, right: 18, flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { width: 39, height: 39, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.93)', alignItems: 'center', justifyContent: 'center' },
  discountPill: { position: 'absolute', bottom: 17, left: 19, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  discountText: { fontSize: 10, fontWeight: '700' },
  details: { paddingHorizontal: 20, paddingTop: 19 },
  categoryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontSize: 9, letterSpacing: 1.4, fontWeight: '800' },
  stock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stockDot: { width: 7, height: 7, borderRadius: 4 },
  stockText: { fontSize: 10, fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  title: { fontSize: 25, lineHeight: 30, letterSpacing: -0.5, fontWeight: '700', flex: 1 },
  price: { fontSize: 23, fontWeight: '800' },
  vendor: { fontSize: 12, marginTop: 5 },
  rule: { borderBottomWidth: 1, marginVertical: 17 },
  description: { fontSize: 13, lineHeight: 21 },
  pickupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, marginTop: 19 },
  pickupIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pickupLabel: { fontSize: 8, letterSpacing: 1, fontWeight: '800' },
  pickupTime: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 16 },
  placeIcon: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 12, fontWeight: '700' },
  placeMeta: { fontSize: 10, marginTop: 4 },
  wasteNote: { borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  wasteText: { flex: 1, fontSize: 10, lineHeight: 15 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15 },
  bottomPrice: { fontSize: 19, fontWeight: '800' },
  bottomMeta: { fontSize: 9, marginTop: 2 },
  reserveButton: { minHeight: 48, flex: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  reserveText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  notFound: { flex: 1, alignItems: 'center', paddingHorizontal: 30 },
  backOnly: { alignSelf: 'flex-start', padding: 8, marginBottom: 28 },
  notFoundTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  notFoundCopy: { fontSize: 12, marginTop: 5 },
});
