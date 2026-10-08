import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardTypeOptions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { FoodCategory, ListingPhoto, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  prefix?: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType ?? 'default'}
          style={[styles.input, { color: colors.foreground }]}
          testID={testID}
        />
      </View>
    </View>
  );
}

export default function VendorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, mode, setMode, addListing } = useMarketplace();
  const [name, setName] = useState('');
  const [vendor, setVendor] = useState('');
  const [category, setCategory] = useState<FoodCategory>('Bakery');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pickupWindow, setPickupWindow] = useState('Today, 5:00–6:00 PM');

  const myListings = listings.filter((item) => item.isMine);
  const publish = () => {
    const amount = Number(price);
    const regular = Number(originalPrice);
    const portions = Number(quantity);
    if (!name.trim() || !vendor.trim()) {
      Alert.alert('A little more detail', 'Add a food name and your shop name first.');
      return;
    }
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(regular) ||
      amount <= 0 ||
      regular <= amount
    ) {
      Alert.alert('Check your prices', 'The discounted price needs to be positive and lower than the usual price.');
      return;
    }
    if (!Number.isInteger(portions) || portions < 1) {
      Alert.alert('Add available portions', 'Enter at least one bag or serving.');
      return;
    }
    const photo: ListingPhoto = category === 'Bakery' ? 'bakery' : 'lunch';
    addListing({
      name: name.trim(),
      vendor: vendor.trim(),
      category,
      price: amount,
      originalPrice: regular,
      quantity: portions,
      pickupWindow: pickupWindow.trim() || 'Today, 5:00–6:00 PM',
      area: 'Hayes Valley',
      distance: 'Nearby',
      photo,
      description: `${name.trim()} from ${vendor.trim()}, available for a neighborhood pickup.`,
    });
    setName('');
    setVendor('');
    setPrice('');
    setOriginalPrice('');
    setQuantity('');
    setMode('vendor');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Your offer is live', 'Neighbors can now find your surplus food.');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 14,
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'web' ? 106 : Math.max(insets.bottom, 12) + 100,
        }}
        bottomOffset={70}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>FOR LOCAL FOOD SHOPS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Save your surplus</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Turn today’s extras into someone’s favorite find.
        </Text>

        {mode !== 'vendor' ? (
          <Pressable
            onPress={() => setMode('vendor')}
            style={[styles.modeBanner, { backgroundColor: colors.foreground }]}
            accessibilityRole="button"
            testID="switch-to-vendor"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeBannerTitle, { color: colors.background }]}>Switch to vendor view</Text>
              <Text style={[styles.modeBannerCopy, { color: '#d9e5d7' }]}>
                You can shop again any time.
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.background} />
          </Pressable>
        ) : null}

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formHeading}>
            <View style={[styles.formIcon, { backgroundColor: colors.accent }]}>
              <Feather name="plus" size={17} color={colors.secondaryForeground} />
            </View>
            <View>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Post a pickup offer</Text>
              <Text style={[styles.formNote, { color: colors.mutedForeground }]}>Takes about a minute</Text>
            </View>
          </View>

          <Field label="What’s available?" value={name} onChangeText={setName} placeholder="e.g. End-of-day pastry bag" testID="listing-name" />
          <Field label="Shop name" value={vendor} onChangeText={setVendor} placeholder="Your bakery or cafe" testID="vendor-name" />

          <Text style={[styles.label, { color: colors.foreground }]}>Food type</Text>
          <View style={styles.categories}>
            {(['Bakery', 'Cafe', 'Meals'] as FoodCategory[]).map((item) => {
              const selected = item === category;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryButton,
                    { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : colors.background },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`vendor-category-${item.toLowerCase()}`}
                >
                  <Text style={[styles.categoryText, { color: selected ? colors.background : colors.secondaryForeground }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Field label="Your price" value={price} onChangeText={setPrice} placeholder="6" keyboardType="decimal-pad" prefix="$" testID="discount-price" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Usual price" value={originalPrice} onChangeText={setOriginalPrice} placeholder="18" keyboardType="decimal-pad" prefix="$" testID="original-price" />
            </View>
          </View>
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Field label="Available portions" value={quantity} onChangeText={setQuantity} placeholder="4" keyboardType="number-pad" testID="listing-quantity" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Pickup window" value={pickupWindow} onChangeText={setPickupWindow} placeholder="Today, 5–6 PM" testID="pickup-window" />
            </View>
          </View>

          <View style={[styles.pickupNote, { backgroundColor: colors.accent }]}>
            <Feather name="map-pin" size={14} color={colors.secondaryForeground} />
            <Text style={[styles.pickupNoteText, { color: colors.secondaryForeground }]}>
              Pickup location is set to your shop area.
            </Text>
          </View>
          <Pressable
            onPress={publish}
            style={({ pressed }) => [
              styles.publishButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            testID="publish-listing"
          >
            <Feather name="send" size={15} color={colors.primaryForeground} />
            <Text style={[styles.publishText, { color: colors.primaryForeground }]}>Post this offer</Text>
          </Pressable>
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Neighbors reserve online and pay when they pick up.
          </Text>
        </View>

        <View style={styles.liveHeader}>
          <Text style={[styles.liveTitle, { color: colors.foreground }]}>Your live offers</Text>
          <Text style={[styles.liveCount, { color: colors.mutedForeground }]}>{myListings.length} active</Text>
        </View>
        {myListings.length ? (
          myListings.map((item) => (
            <View key={item.id} style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.liveDot, { backgroundColor: item.quantity > 0 ? '#57946a' : colors.mutedForeground }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.liveName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.liveMeta, { color: colors.mutedForeground }]}>
                  {item.quantity > 0 ? `${item.quantity} portions left` : 'All picked up'} · ${item.price}
                </Text>
              </View>
              <Feather name={item.quantity > 0 ? 'radio' : 'check-circle'} size={16} color={colors.secondaryForeground} />
            </View>
          ))
        ) : (
          <View style={[styles.noOffers, { borderColor: colors.border }]}>
            <Text style={[styles.noOffersText, { color: colors.mutedForeground }]}>
              Your posted offers will show up here.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 29, letterSpacing: -0.6, fontWeight: '700', marginTop: 5 },
  subtitle: { fontSize: 12, marginTop: 4, marginBottom: 20 },
  modeBanner: { borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  modeBannerTitle: { fontSize: 13, fontWeight: '700' },
  modeBannerCopy: { fontSize: 10, marginTop: 3 },
  formCard: { borderWidth: 1, borderRadius: 23, padding: 15 },
  formHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  formIcon: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 15, fontWeight: '700' },
  formNote: { fontSize: 10, marginTop: 3 },
  field: { flex: 1, marginBottom: 13 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  inputWrap: { height: 45, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 12, paddingVertical: 8 },
  prefix: { marginRight: 4, fontSize: 12 },
  categories: { flexDirection: 'row', gap: 7, marginBottom: 15 },
  categoryButton: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10 },
  pickupNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 13, marginTop: 2 },
  pickupNoteText: { fontSize: 10, flex: 1 },
  publishButton: { minHeight: 47, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 13 },
  publishText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  disclaimer: { fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 9 },
  liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  liveTitle: { fontSize: 17, fontWeight: '700' },
  liveCount: { fontSize: 10 },
  liveCard: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 5 },
  liveName: { fontSize: 12, fontWeight: '700' },
  liveMeta: { fontSize: 10, marginTop: 4 },
  noOffers: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 15, alignItems: 'center' },
  noOffersText: { fontSize: 11 },
});
