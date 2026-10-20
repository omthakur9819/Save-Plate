import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { FoodListing } from '@/context/MarketplaceContext';
import { NearbyMapProps } from './NearbyMap.types';

export default function GoogleMapsWebView({
  items,
  onMarkerPress,
  center,
  userLocation,
  selectedId,
  onSelectMarker,
  onLocateMe,
}: NearbyMapProps) {
  const [isLocating, setIsLocating] = useState(false);

  // Active item if selected
  const activeItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => i.id === selectedId) || null;
  }, [items, selectedId]);

  // Determine current map coordinates
  const activeCoord = useMemo(() => {
    if (activeItem && activeItem.latitude && activeItem.longitude) {
      return { latitude: activeItem.latitude, longitude: activeItem.longitude, zoom: 16 };
    }
    if (center && center.latitude && center.longitude) {
      return { latitude: center.latitude, longitude: center.longitude, zoom: 15 };
    }
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      return { latitude: userLocation.latitude, longitude: userLocation.longitude, zoom: 16 };
    }
    if (items.length > 0 && items[0].latitude && items[0].longitude) {
      return { latitude: items[0].latitude, longitude: items[0].longitude, zoom: 14 };
    }
    return { latitude: 19.0595, longitude: 72.8315, zoom: 13 };
  }, [activeItem, center, userLocation, items]);

  // Google Maps embed URL
  const embedUrl = useMemo(() => {
    const lat = activeCoord.latitude;
    const lng = activeCoord.longitude;
    const z = activeCoord.zoom;
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=${z}&output=embed`;
  }, [activeCoord]);

  // HTML content rendering the Google Maps iframe
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

  const handleSpotPress = (item: FoodListing) => {
    onSelectMarker?.(item);
    onMarkerPress(item);
  };

  const handleLocateMePress = async () => {
    setIsLocating(true);
    try {
      await onLocateMe?.();
    } finally {
      setTimeout(() => setIsLocating(false), 800);
    }
  };

  const openInGoogleMapsApp = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${activeCoord.latitude},${activeCoord.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const AnyWebView = WebView as any;

  return (
    <View style={styles.container}>
      {/* Google Maps Embed Iframe inside WebView */}
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

        {/* Top Controls: External Google Maps app link & GPS Locate button */}
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

          {onLocateMe && (
            <Pressable
              onPress={handleLocateMePress}
              style={[styles.locateBtn, isLocating && styles.locateBtnActive]}
              accessibilityRole="button"
              accessibilityLabel="Center Google Maps on my location"
            >
              <Feather
                name={isLocating ? 'loader' : 'crosshair'}
                size={16}
                color={userLocation ? '#2563eb' : '#2b8253'}
              />
            </Pressable>
          )}
        </View>

        {/* User GPS Active Badge */}
        {userLocation && (
          <View style={styles.gpsBadge}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>GPS Active</Text>
          </View>
        )}
      </View>

      {/* Spots Quick-Switch Carousel */}
      <View style={styles.spotsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotsScroll}
        >
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleSpotPress(item)}
                style={[
                  styles.spotChip,
                  isSelected && styles.spotChipSelected,
                  item.isMine && styles.spotChipMine,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Focus ${item.name} on Google Maps`}
              >
                <Feather
                  name={item.isMine ? 'star' : 'map-pin'}
                  size={12}
                  color={isSelected ? '#ffffff' : item.isMine ? '#2b8253' : '#173b2d'}
                />
                <Text
                  style={[
                    styles.spotChipName,
                    isSelected && styles.spotChipNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {item.vendor}
                </Text>
                <View
                  style={[
                    styles.spotPriceBadge,
                    isSelected && styles.spotPriceBadgeSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.spotPriceText,
                      isSelected && styles.spotPriceTextSelected,
                    ]}
                  >
                    ₹{item.price}
                  </Text>
                </View>
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
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  mapWrapper: {
    height: 310,
    width: '100%',
    position: 'relative',
    backgroundColor: '#e8eddf',
  },
  webView: {
    flex: 1,
    backgroundColor: '#e8eddf',
  },
  topBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  externalBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  externalBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1b4d3e',
  },
  locateBtn: {
    width: 38,
    height: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  locateBtnActive: {
    backgroundColor: '#eff6ff',
  },
  gpsBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
  },
  gpsText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  spotsBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f2',
  },
  spotsScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#f4f6f4',
    borderWidth: 1,
    borderColor: '#e2e8e3',
  },
  spotChipSelected: {
    backgroundColor: '#e2764d',
    borderColor: '#d0643a',
  },
  spotChipMine: {
    borderColor: '#a3d9b8',
  },
  spotChipName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2d3748',
  },
  spotChipNameSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  spotPriceBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  spotPriceBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  spotPriceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2b8253',
  },
  spotPriceTextSelected: {
    color: '#ffffff',
  },
});
