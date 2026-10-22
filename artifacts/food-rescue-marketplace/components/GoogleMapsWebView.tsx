import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { TravelMode } from '@/lib/aStarRouting';
import { NearbyMapProps } from './NearbyMap.types';

export default function GoogleMapsWebView({
  items,
  onMarkerPress,
  center,
  userLocation,
  selectedId,
  onSelectMarker,
  onLocateMe,
  routeDestination,
  routeEstimate,
  isRoutingLoading,
  travelMode = 'driving',
  onChangeTravelMode,
  onStartRoute,
  onClearRoute,
}: NearbyMapProps) {
  const [isLocating, setIsLocating] = useState(false);

  // Active item if selected
  const activeItem = useMemo(() => {
    if (routeDestination) return routeDestination;
    if (!selectedId) return null;
    return items.find((i) => i.id === selectedId) || null;
  }, [items, selectedId, routeDestination]);

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

  // Google Maps embed URL:
  // If route mode is active and user location is available, render Google Maps directions!
  const embedUrl = useMemo(() => {
    if (routeDestination && userLocation) {
      const sLat = userLocation.latitude;
      const sLng = userLocation.longitude;
      const dLat = routeDestination.latitude;
      const dLng = routeDestination.longitude;
      return `https://maps.google.com/maps?saddr=${sLat},${sLng}&daddr=${dLat},${dLng}&hl=en&output=embed`;
    }

    const lat = activeCoord.latitude;
    const lng = activeCoord.longitude;
    const z = activeCoord.zoom;
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=${z}&output=embed`;
  }, [routeDestination, userLocation, activeCoord]);

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
    if (routeDestination && userLocation) {
      const gMode =
        travelMode === 'walking' ? 'walking' : travelMode === 'two_wheeler' ? 'two_wheeler' : 'driving';
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${routeDestination.latitude},${routeDestination.longitude}&travelmode=${gMode}`;
      Linking.openURL(url).catch(() => {});
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${activeCoord.latitude},${activeCoord.longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  const AnyWebView = WebView as any;

  return (
    <View style={styles.container}>
      {/* Route Info & ETA Top Floating Sheet */}
      {routeDestination && (
        <View style={styles.routeHeaderCard}>
          <View style={styles.routeHeaderTop}>
            <View style={styles.routeDestRow}>
              <View style={styles.routeDestBadge}>
                <Feather name="navigation" size={14} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeDestTitle} numberOfLines={1}>
                  Route to {routeDestination.vendor}
                </Text>
                <Text style={styles.routeDestSub} numberOfLines={1}>
                  {routeDestination.area} · {routeDestination.name}
                </Text>
              </View>
            </View>

            {onClearRoute && (
              <Pressable
                onPress={onClearRoute}
                hitSlop={8}
                style={styles.closeRouteBtn}
                accessibilityRole="button"
                accessibilityLabel="Close route view"
              >
                <Feather name="x" size={16} color="#64748b" />
              </Pressable>
            )}
          </View>

          {/* Live ETA, Distance & Arrival Time */}
          {isRoutingLoading ? (
            <View style={styles.routeLoadingRow}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.routeLoadingText}>Computing fastest route with A* algorithm...</Text>
            </View>
          ) : routeEstimate ? (
            <View style={styles.routeMetricsRow}>
              <View style={styles.etaContainer}>
                <Text style={styles.etaValue}>{routeEstimate.etaText}</Text>
                <Text style={styles.etaDistance}>({routeEstimate.distanceText})</Text>
              </View>

              <View style={styles.arrivalContainer}>
                <View style={styles.greenDot} />
                <Text style={styles.arrivalText}>Arrive by {routeEstimate.arrivalTime}</Text>
              </View>

              <View style={styles.aStarBadge}>
                <Text style={styles.aStarBadgeText}>
                  {routeEstimate.method === 'a-star' ? 'A* OPTIMIZED' : 'FASTEST ROUTE'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Travel Mode Selector: Car / Scooter / Walking */}
          <View style={styles.modeSelector}>
            <Pressable
              onPress={() => onChangeTravelMode?.('driving')}
              style={[
                styles.modeBtn,
                travelMode === 'driving' && styles.modeBtnActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Driving route"
            >
              <Text style={styles.modeEmoji}>🚗</Text>
              <Text
                style={[
                  styles.modeBtnText,
                  travelMode === 'driving' && styles.modeBtnTextActive,
                ]}
              >
                Drive
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onChangeTravelMode?.('two_wheeler')}
              style={[
                styles.modeBtn,
                travelMode === 'two_wheeler' && styles.modeBtnActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Two-wheeler / scooter route"
            >
              <Text style={styles.modeEmoji}>🛵</Text>
              <Text
                style={[
                  styles.modeBtnText,
                  travelMode === 'two_wheeler' && styles.modeBtnTextActive,
                ]}
              >
                Bike
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onChangeTravelMode?.('walking')}
              style={[
                styles.modeBtn,
                travelMode === 'walking' && styles.modeBtnActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Walking route"
            >
              <Text style={styles.modeEmoji}>🚶</Text>
              <Text
                style={[
                  styles.modeBtnText,
                  travelMode === 'walking' && styles.modeBtnTextActive,
                ]}
              >
                Walk
              </Text>
            </Pressable>

            <Pressable
              onPress={openInGoogleMapsApp}
              style={styles.openNavAppBtn}
              accessibilityRole="button"
              accessibilityLabel="Start navigation in Google Maps App"
            >
              <Feather name="send" size={12} color="#ffffff" />
              <Text style={styles.openNavAppBtnText}>Start Nav</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Google Maps Embed Iframe inside WebView */}
      <View style={[styles.mapWrapper, routeDestination ? { height: 280 } : null]}>
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
        {!routeDestination && (
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
        )}

        {/* User GPS Active Badge */}
        {userLocation && (
          <View style={styles.gpsBadge}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsText}>GPS Active</Text>
          </View>
        )}
      </View>

      {/* Spots Quick-Switch Carousel with Directions Triggers */}
      <View style={styles.spotsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotsScroll}
        >
          {items.map((item) => {
            const isSelected = selectedId === item.id;
            const isRoutingToThis = routeDestination?.id === item.id;

            return (
              <View
                key={item.id}
                style={[
                  styles.spotCardItem,
                  isSelected && styles.spotChipSelected,
                  isRoutingToThis && styles.spotChipRouting,
                  item.isMine && styles.spotChipMine,
                ]}
              >
                <Pressable
                  onPress={() => handleSpotPress(item)}
                  style={styles.spotPressArea}
                  accessibilityRole="button"
                  accessibilityLabel={`Focus ${item.name} on map`}
                >
                  <Feather
                    name={isRoutingToThis ? 'navigation' : item.isMine ? 'star' : 'map-pin'}
                    size={12}
                    color={
                      isRoutingToThis
                        ? '#2563eb'
                        : isSelected
                        ? '#ffffff'
                        : item.isMine
                        ? '#2b8253'
                        : '#173b2d'
                    }
                  />
                  <Text
                    style={[
                      styles.spotChipName,
                      isSelected && styles.spotChipNameSelected,
                      isRoutingToThis && { color: '#1e3a8a', fontWeight: '800' },
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

                {/* Quick Route Button for Spot */}
                {onStartRoute && (
                  <Pressable
                    onPress={() => onStartRoute(item)}
                    style={[
                      styles.spotRouteBtn,
                      isRoutingToThis && styles.spotRouteBtnActive,
                    ]}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Get estimated route to ${item.vendor}`}
                  >
                    <Feather
                      name="navigation"
                      size={11}
                      color={isRoutingToThis ? '#ffffff' : '#2563eb'}
                    />
                    <Text
                      style={[
                        styles.spotRouteBtnText,
                        isRoutingToThis && styles.spotRouteBtnTextActive,
                      ]}
                    >
                      {isRoutingToThis ? 'Routing' : 'Route'}
                    </Text>
                  </Pressable>
                )}
              </View>
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
  routeHeaderCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  routeHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  routeDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  routeDestBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeDestTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  routeDestSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  closeRouteBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  routeLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 4,
  },
  routeLoadingText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  routeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  etaValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803d',
  },
  etaDistance: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  arrivalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  arrivalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  aStarBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  aStarBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  modeBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  modeEmoji: {
    fontSize: 11,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  openNavAppBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#15803d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  openNavAppBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
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
  spotCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#f4f6f4',
    borderWidth: 1,
    borderColor: '#e2e8e3',
    overflow: 'hidden',
  },
  spotPressArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
  },
  spotChipSelected: {
    backgroundColor: '#e2764d',
    borderColor: '#d0643a',
  },
  spotChipRouting: {
    backgroundColor: '#eff6ff',
    borderColor: '#60a5fa',
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
  spotRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderLeftWidth: 1,
    borderLeftColor: '#cbd5e1',
  },
  spotRouteBtnActive: {
    backgroundColor: '#2563eb',
    borderLeftColor: '#1d4ed8',
  },
  spotRouteBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563eb',
  },
  spotRouteBtnTextActive: {
    color: '#ffffff',
  },
});
