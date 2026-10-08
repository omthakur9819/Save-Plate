import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NearbyMap from '@/components/NearbyMap';
import { ListingCard } from '@/components/ListingCard';
import { FoodListing, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

export default function NearbyMapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, favorites, toggleFavorite } = useMarketplace();
  const [userCenter, setUserCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'located' | 'denied'>('idle');
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const available = listings.filter((item) => item.quantity > 0);
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const openListing = (item: FoodListing) => {
    router.push({ pathname: '/listing/[id]', params: { id: item.id } });
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
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingBottom: Platform.OS === 'web' ? 102 : Math.max(insets.bottom, 12) + 94,
        }}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>FINDS AROUND YOU</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>A little closer</Text>
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              {available.length} good things nearby
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
        {locationStatus === 'denied' && Platform.OS !== 'web' && permission?.status === 'denied' && !permission.canAskAgain ? (
          <Pressable onPress={openSettings} style={[styles.permission, { backgroundColor: colors.accent }]}>
            <Text style={[styles.permissionText, { color: colors.secondaryForeground }]}>
              Location is off. Open Settings to turn it on.
            </Text>
            <Feather name="arrow-up-right" size={15} color={colors.secondaryForeground} />
          </Pressable>
        ) : null}
        <NearbyMap
          items={available}
          onMarkerPress={openListing}
          center={userCenter}
          showUserLocation={!!permission?.granted}
        />
        <View style={styles.mapHint}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
            Tap a spot to see what’s ready for pickup
          </Text>
          <View style={styles.neighborhood}>
            <Text style={[styles.neighborhoodText, { color: colors.secondaryForeground }]}>Mumbai</Text>
            <Feather name="chevron-down" size={13} color={colors.secondaryForeground} />
          </View>
        </View>
        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: colors.foreground }]}>Around the corner</Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>{available.length} finds</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 18, flexDirection: 'row', alignItems: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.5, marginTop: 5 },
  caption: { fontSize: 12, marginTop: 4 },
  locate: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mapHint: { paddingHorizontal: 21, paddingTop: 12, paddingBottom: 23, flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  hintText: { flex: 1, fontSize: 10 },
  neighborhood: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  neighborhoodText: { fontSize: 10, fontWeight: '700' },
  listHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  listTitle: { fontSize: 18, fontWeight: '700' },
  count: { fontSize: 11 },
  cards: { paddingHorizontal: 16 },
  permission: { marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permissionText: { fontSize: 11, fontWeight: '600' },
});
