import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RazorpayDemoModal, RazorpayPaymentResult } from '@/components/RazorpayDemoModal';
import { FoodListing, formatRupees, ListingPhoto, useMarketplace } from '@/context/MarketplaceContext';
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

  const [showPaymentChoice, setShowPaymentChoice] = useState(false);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);

  const handleOpenPaymentChoice = () => {
    if (!listing || listing.quantity < 1) return;
    Haptics.selectionAsync();
    setShowPaymentChoice(true);
  };

  const handlePayAtPickup = async (item: FoodListing) => {
    setShowPaymentChoice(false);
    const reserved = await placeOrder(item, 1, { paymentMethod: 'pay_at_pickup' });
    if (!reserved) {
      Alert.alert('This one just went', 'There are no portions left. Browse other nearby finds.');
      router.back();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'It’s yours!',
      `Your pickup is reserved at ${item.vendor}. Pay ${formatRupees(item.price)} when you collect your order.`,
      [
        {
          text: 'View pickup code',
          onPress: () => router.replace('/orders'),
        },
      ],
    );
  };

  const handleRazorpaySuccess = async (result: RazorpayPaymentResult) => {
    if (!listing) return;
    setShowRazorpayModal(false);
    const reserved = await placeOrder(listing, 1, {
      paymentMethod: 'razorpay',
      paymentId: result.paymentId,
    });
    if (!reserved) {
      Alert.alert('Listing update', 'Could not complete reservation as portions just finished.');
      router.back();
      return;
    }
    Alert.alert(
      'Payment Verified & Reserved!',
      `Paid ${formatRupees(result.amount)} via Razorpay (${result.paymentId}). Your food is safely reserved at ${listing.vendor}.`,
      [
        {
          text: 'View pickup code',
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
          <Image
            source={listing.imageUri ? { uri: listing.imageUri } : photos[listing.photo]}
            style={styles.heroImage}
          />
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
            <Text style={[styles.price, { color: colors.foreground }]}>{formatRupees(listing.price)}</Text>
          </View>
          <Text style={[styles.vendor, { color: colors.mutedForeground }]}>
            From {listing.vendor} · <Text style={{ textDecorationLine: 'line-through' }}>{formatRupees(listing.originalPrice)}</Text>
          </Text>
          <View style={[styles.rule, { borderColor: colors.border }]} />
          <Text style={[styles.description, { color: colors.foreground }]}>{listing.description}</Text>

          {/* Payment Guarantee & Options Banner */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setShowRazorpayModal(true);
            }}
            style={({ pressed }) => [
              styles.paymentBanner,
              { backgroundColor: '#f0f9ff', borderColor: '#bae6fd' },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open Razorpay demo payment"
            testID="razorpay-banner-trigger"
          >
            <View style={styles.paymentBannerBadge}>
              <Text style={styles.paymentBannerBadgeText}>R</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.paymentBannerTitle}>Razorpay Demo Payment</Text>
                <View style={styles.testBadgePill}>
                  <Text style={styles.testBadgePillText}>TEST MODE</Text>
                </View>
              </View>
              <Text style={styles.paymentBannerSubtitle}>
                Pay online with test UPI/Cards or choose to pay at counter. Tap to test!
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color="#0c2340" />
          </Pressable>

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
              <Text style={[styles.placeMeta, { color: colors.mutedForeground }]}>{listing.distance} away · Online & counter payment</Text>
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

      {/* Bottom Bar */}
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
          <Text style={[styles.bottomPrice, { color: colors.foreground }]}>{formatRupees(listing.price)}</Text>
          <Text style={[styles.bottomMeta, { color: colors.mutedForeground }]}>online or at counter</Text>
        </View>
        <Pressable
          onPress={handleOpenPaymentChoice}
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
            {listing.quantity > 0 ? 'Reserve & Pay' : 'All picked up'}
          </Text>
          {listing.quantity > 0 ? <Feather name="arrow-right" size={16} color={colors.primaryForeground} /> : null}
        </Pressable>
      </View>

      {/* Payment Method Choice Modal */}
      <Modal
        visible={showPaymentChoice}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPaymentChoice(false)}
      >
        <View style={styles.choiceBackdrop}>
          <View style={[styles.choiceSheet, { backgroundColor: colors.card }]}>
            <View style={styles.choiceHeader}>
              <View>
                <Text style={[styles.choiceTitle, { color: colors.foreground }]}>How would you like to pay?</Text>
                <Text style={[styles.choiceSubtitle, { color: colors.mutedForeground }]}>
                  {listing.name} · {formatRupees(listing.price)}
                </Text>
              </View>
              <Pressable onPress={() => setShowPaymentChoice(false)} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Option 1: Razorpay Online Demo */}
            <Pressable
              onPress={() => {
                setShowPaymentChoice(false);
                setTimeout(() => setShowRazorpayModal(true), 150);
              }}
              style={styles.razorpayOptionCard}
              testID="choose-razorpay"
            >
              <View style={styles.razorpayBadge}>
                <Text style={styles.razorpayBadgeR}>R</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.razorpayOptionTitle}>Razorpay Demo Payment</Text>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>RECOMMENDED</Text>
                  </View>
                </View>
                <Text style={styles.razorpayOptionSub}>
                  UPI (GPay/PhonePe/Paytm), Cards, Netbanking · Test Mode
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#0c2340" />
            </Pressable>

            {/* Option 2: Pay at Counter */}
            <Pressable
              onPress={() => handlePayAtPickup(listing)}
              style={[styles.counterOptionCard, { borderColor: colors.border }]}
              testID="choose-pay-at-pickup"
            >
              <View style={[styles.counterIconBox, { backgroundColor: colors.accent }]}>
                <Feather name="clock" size={18} color={colors.secondaryForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.counterOptionTitle, { color: colors.foreground }]}>Pay at Pickup Counter</Text>
                <Text style={[styles.counterOptionSub, { color: colors.mutedForeground }]}>
                  Reserve your portion now, pay cash/UPI in person
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>

            <Text style={[styles.choiceSecurityNote, { color: colors.mutedForeground }]}>
              Safe food rescue checkout · Guaranteed portion holds
            </Text>
          </View>
        </View>
      </Modal>

      {/* Razorpay Demo Test Modal */}
      <RazorpayDemoModal
        visible={showRazorpayModal}
        listing={listing}
        onClose={() => setShowRazorpayModal(false)}
        onSuccess={handleRazorpaySuccess}
      />
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
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginTop: 16,
  },
  paymentBannerBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#0c2340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentBannerBadgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  paymentBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0c2340',
  },
  testBadgePill: {
    backgroundColor: '#fef08a',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  testBadgePillText: {
    color: '#854d0e',
    fontSize: 8,
    fontWeight: '800',
  },
  paymentBannerSubtitle: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  pickupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 17, marginTop: 14 },
  pickupIcon: { width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pickupLabel: { fontSize: 8, letterSpacing: 1, fontWeight: '800' },
  pickupTime: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 16 },
  placeIcon: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 12, fontWeight: '700' },
  placeMeta: { fontSize: 10, marginTop: 4 },
  wasteNote: { borderWidth: 1, borderRadius: 15, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  wasteText: { flex: 1, fontSize: 10, lineHeight: 15 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, zIndex: 50 },
  bottomPrice: { fontSize: 19, fontWeight: '800' },
  bottomMeta: { fontSize: 9, marginTop: 2 },
  reserveButton: { minHeight: 48, flex: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  reserveText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  notFound: { flex: 1, alignItems: 'center', paddingHorizontal: 30 },
  backOnly: { alignSelf: 'flex-start', padding: 8, marginBottom: 28 },
  notFoundTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  notFoundCopy: { fontSize: 12, marginTop: 5 },

  // Choice Modal Styles
  choiceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  choiceSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'web' ? 40 : 34,
    gap: 12,
  },
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  choiceTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  choiceSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  razorpayOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1.5,
    borderColor: '#0c2340',
    borderRadius: 16,
    padding: 14,
  },
  razorpayBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0c2340',
    alignItems: 'center',
    justifyContent: 'center',
  },
  razorpayBadgeR: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  razorpayOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0c2340',
  },
  popularBadge: {
    backgroundColor: '#2b8253',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  razorpayOptionSub: {
    fontSize: 10,
    color: '#475569',
    marginTop: 3,
  },
  counterOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  counterIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  counterOptionSub: {
    fontSize: 10,
    marginTop: 3,
  },
  choiceSecurityNote: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
});

