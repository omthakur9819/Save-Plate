import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MUMBAI_NEIGHBORHOOD_COORDS } from '@/context/MarketplaceContext';
import { LocationPickerMapProps } from './LocationPickerMap.types';

const NEIGHBORHOOD_CHIPS = [
  { name: 'Bandra', coords: MUMBAI_NEIGHBORHOOD_COORDS['bandra west'] },
  { name: 'BKC', coords: MUMBAI_NEIGHBORHOOD_COORDS['bkc'] },
  { name: 'Juhu', coords: MUMBAI_NEIGHBORHOOD_COORDS['juhu'] },
  { name: 'Andheri', coords: MUMBAI_NEIGHBORHOOD_COORDS['andheri west'] },
  { name: 'Worli', coords: MUMBAI_NEIGHBORHOOD_COORDS['worli'] },
  { name: 'Colaba', coords: MUMBAI_NEIGHBORHOOD_COORDS['colaba'] },
  { name: 'Powai', coords: MUMBAI_NEIGHBORHOOD_COORDS['powai'] },
  { name: 'Dadar', coords: MUMBAI_NEIGHBORHOOD_COORDS['dadar'] },
];

export default function GoogleMapsLocationPickerWebView({
  coordinate,
  onCoordinateChange,
  areaName,
  center,
}: LocationPickerMapProps) {
  const [isLocating, setIsLocating] = useState(false);

  const activeCoord = center || coordinate;

  const embedUrl = useMemo(() => {
    return `https://maps.google.com/maps?q=${activeCoord.latitude},${activeCoord.longitude}&hl=en&z=15&output=embed`;
  }, [activeCoord.latitude, activeCoord.longitude]);

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #e8eddf;
      touch-action: pan-x pan-y pinch-zoom;
      -webkit-user-select: none;
      user-select: none;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
      touch-action: pan-x pan-y pinch-zoom;
      pointer-events: auto;
    }
  </style>
</head>
<body>
  <iframe
    id="google-maps-frame"
    src="${embedUrl}"
    width="100%"
    height="100%"
    style="border:0;"
    allowfullscreen=""
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>
</body>
</html>
    `;
  }, [embedUrl]);

  const handleChipPress = (name: string, coords: { latitude: number; longitude: number }) => {
    onCoordinateChange(coords, name);
    Haptics.selectionAsync();
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const newCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      onCoordinateChange(newCoords, 'My Current Location');
      Haptics.selectionAsync();
    } catch {
    } finally {
      setIsLocating(false);
    }
  };

  const openInGoogleMapsApp = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${coordinate.latitude},${coordinate.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const AnyWebView = WebView as any;

  return (
    <View style={styles.container}>
      <View style={styles.mapWrapper}>
        <AnyWebView
          key={embedUrl}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.webView}
          scrollEnabled={true}
          nestedScrollEnabled={true}
          overScrollMode="never"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
        />

        {/* Top Controls */}
        <View style={styles.topBar}>
          <Pressable
            onPress={openInGoogleMapsApp}
            style={styles.externalBtn}
            accessibilityRole="button"
            accessibilityLabel="Open in Google Maps App"
          >
            <Feather name="external-link" size={13} color="#1b4d3e" />
            <Text style={styles.externalBtnText}>Open in Google Maps</Text>
          </Pressable>

          <Pressable
            onPress={handleLocateMe}
            style={[styles.locateBtn, isLocating && styles.locateBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Pin my current location"
          >
            <Feather
              name={isLocating ? 'loader' : 'crosshair'}
              size={16}
              color="#2b8253"
            />
          </Pressable>
        </View>

        {/* Selected Area Callout */}
        <View style={styles.areaCallout}>
          <Feather name="map-pin" size={12} color="#2b8253" />
          <Text style={styles.areaCalloutText} numberOfLines={1}>
            {areaName || 'Shop Location'}
          </Text>
        </View>
      </View>

      {/* Neighborhood Quick-Select Bar */}
      <View style={styles.neighborhoodBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.neighborhoodScroll}
        >
          {NEIGHBORHOOD_CHIPS.map((chip) => {
            const isMatch = areaName?.toLowerCase().includes(chip.name.toLowerCase());
            return (
              <Pressable
                key={chip.name}
                onPress={() => handleChipPress(chip.name, chip.coords)}
                style={[styles.chip, isMatch && styles.chipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Select ${chip.name}`}
              >
                <Text style={[styles.chipText, isMatch && styles.chipTextActive]}>
                  {chip.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#e8eddf',
  },
  webView: {
    flex: 1,
    backgroundColor: '#e8eddf',
  },
  topBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  externalBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  externalBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1b4d3e',
  },
  locateBtn: {
    width: 36,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  locateBtnActive: {
    backgroundColor: '#eff6ff',
  },
  areaCallout: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  areaCalloutText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#173b2d',
  },
  neighborhoodBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f2',
  },
  neighborhoodScroll: {
    paddingHorizontal: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f4f6f4',
    borderWidth: 1,
    borderColor: '#e2e8e3',
  },
  chipActive: {
    backgroundColor: '#2b8253',
    borderColor: '#236943',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2d3748',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
