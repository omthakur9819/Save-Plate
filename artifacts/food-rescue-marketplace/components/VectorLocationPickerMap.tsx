import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  DimensionValue,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { MUMBAI_NEIGHBORHOOD_COORDS } from '@/context/MarketplaceContext';
import { LocationPickerMapProps } from './LocationPickerMap.types';

const MAP_LANDMARKS = [
  { name: 'Colaba', lat: 18.9067, lng: 72.8147 },
  { name: 'Worli', lat: 19.0166, lng: 72.8166 },
  { name: 'Dadar', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
  { name: 'BKC', lat: 19.0657, lng: 72.8687 },
  { name: 'Juhu', lat: 19.1075, lng: 72.8263 },
  { name: 'Andheri', lat: 19.1197, lng: 72.8464 },
  { name: 'Powai', lat: 19.1176, lng: 72.9060 },
  { name: 'Borivali', lat: 19.2307, lng: 72.8567 },
  { name: 'Thane', lat: 19.2183, lng: 72.9781 },
  { name: 'Vashi', lat: 19.0771, lng: 72.9986 },
];

export default function VectorLocationPickerMap({
  coordinate,
  onCoordinateChange,
  areaName,
  center,
  zoom = 1.0,
  onZoomIn,
  onZoomOut,
  onZoomToAllMumbai,
  onCenterOnPin,
}: LocationPickerMapProps) {
  const [mapLayout, setMapLayout] = useState({ width: 360, height: 270 });

  const activeCenter = center || coordinate;

  // Dynamic bounds for coordinate math respecting the exact container aspect ratio
  const mapBounds = useMemo(() => {
    const width = Math.max(300, mapLayout.width);
    const height = Math.max(200, mapLayout.height);
    const aspect = width / height;
    // Mumbai latitude ~19.07N: cos(19.07 deg) = ~0.945
    const latSpan = 0.16 / zoom;
    const lngSpan = (latSpan * aspect) * 0.945;
    return {
      minLat: activeCenter.latitude - latSpan / 2,
      maxLat: activeCenter.latitude + latSpan / 2,
      minLng: activeCenter.longitude - lngSpan / 2,
      maxLng: activeCenter.longitude + lngSpan / 2,
    };
  }, [activeCenter, zoom, mapLayout.width, mapLayout.height]);

  const handleMapTap = async (locationX: number, locationY: number) => {
    const { minLat, maxLat, minLng, maxLng } = mapBounds;
    const normX = Math.max(0, Math.min(1, locationX / mapLayout.width));
    const normY = Math.max(0, Math.min(1, locationY / mapLayout.height));

    const newLng = Number((minLng + normX * (maxLng - minLng)).toFixed(5));
    const newLat = Number((maxLat - normY * (maxLat - minLat)).toFixed(5));
    const newCoords = { latitude: newLat, longitude: newLng };

    // 1. Immediately find closest local neighborhood from our comprehensive index
    let closestName = 'Bandra West';
    let closestDist = Infinity;
    for (const [nameKey, c] of Object.entries(MUMBAI_NEIGHBORHOOD_COORDS)) {
      const d = Math.hypot(c.latitude - newCoords.latitude, c.longitude - newCoords.longitude);
      if (d < closestDist) {
        closestDist = d;
        closestName = nameKey
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }

    onCoordinateChange(newCoords, closestName);
    Haptics.selectionAsync();

    // 2. Query reverse geocoding for pinpoint street/suburb accuracy
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&zoom=16&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      if (res.ok) {
        const data = await res.json();
        const addr = data.address;
        const placeName =
          addr?.neighbourhood ||
          addr?.suburb ||
          addr?.residential ||
          addr?.road ||
          addr?.city_district ||
          addr?.quarter ||
          closestName;
        if (placeName && placeName !== closestName) {
          onCoordinateChange(newCoords, placeName);
        }
      }
    } catch {
      // Fallback already assigned closestName
    }
  };

  const pinLeftPercent = useMemo(() => {
    const { minLng, maxLng } = mapBounds;
    const norm = (coordinate.longitude - minLng) / (maxLng - minLng);
    return `${Math.max(3, Math.min(97, norm * 100)).toFixed(1)}%` as DimensionValue;
  }, [coordinate.longitude, mapBounds]);

  const pinTopPercent = useMemo(() => {
    const { minLat, maxLat } = mapBounds;
    const norm = (maxLat - coordinate.latitude) / (maxLat - minLat);
    return `${Math.max(5, Math.min(95, norm * 100)).toFixed(1)}%` as DimensionValue;
  }, [coordinate.latitude, mapBounds]);

  // Coordinate-to-pixel helper for accurate SVG drawing
  const getPixelPos = (lat: number, lng: number) => {
    const { minLat, maxLat, minLng, maxLng } = mapBounds;
    const x = ((lng - minLng) / (maxLng - minLng)) * mapLayout.width;
    const y = ((maxLat - lat) / (maxLat - minLat)) * mapLayout.height;
    return { x, y };
  };

  // Landmark pixel positions
  const lmPixels = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    for (const lm of MAP_LANDMARKS) {
      map[lm.name] = getPixelPos(lm.lat, lm.lng);
    }
    return map;
  }, [mapBounds, mapLayout.width, mapLayout.height]);

  return (
    <View style={styles.container}>
      <Pressable
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setMapLayout({ width, height });
          }
        }}
        onPress={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleMapTap(locationX, locationY);
        }}
        // @ts-ignore
        onWheel={(e: any) => {
          if (Platform.OS === 'web') {
            if (e.deltaY < 0 && onZoomIn) {
              onZoomIn();
            } else if (e.deltaY > 0 && onZoomOut) {
              onZoomOut();
            }
          }
        }}
        style={styles.touchArea}
      >
        {/* Geometrically Exact Vector Base Map */}
        <Svg width="100%" height="100%" viewBox={`0 0 ${mapLayout.width} ${mapLayout.height}`} style={styles.svgLayer}>
          <Rect width={mapLayout.width} height={mapLayout.height} fill="#e8eddf" />

          {/* Western Railway / Express Highway arterial corridor */}
          {lmPixels['Colaba'] && lmPixels['Worli'] && lmPixels['Bandra'] && lmPixels['Andheri'] && lmPixels['Borivali'] && (
            <Path
              d={`M${lmPixels['Colaba'].x} ${lmPixels['Colaba'].y + 40} L${lmPixels['Colaba'].x} ${lmPixels['Colaba'].y} L${lmPixels['Worli'].x} ${lmPixels['Worli'].y} L${lmPixels['Bandra'].x} ${lmPixels['Bandra'].y} L${lmPixels['Andheri'].x} ${lmPixels['Andheri'].y} L${lmPixels['Borivali'].x} ${lmPixels['Borivali'].y} L${lmPixels['Borivali'].x} ${lmPixels['Borivali'].y - 40}`}
              fill="none"
              stroke="#faf8f2"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Central & Eastern transit line */}
          {lmPixels['Dadar'] && lmPixels['BKC'] && lmPixels['Powai'] && lmPixels['Thane'] && (
            <Path
              d={`M${lmPixels['Dadar'].x} ${lmPixels['Dadar'].y} L${lmPixels['BKC'].x} ${lmPixels['BKC'].y} L${lmPixels['Powai'].x} ${lmPixels['Powai'].y} L${lmPixels['Thane'].x} ${lmPixels['Thane'].y}`}
              fill="none"
              stroke="#faf8f2"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Harbour / Navi Mumbai link */}
          {lmPixels['BKC'] && lmPixels['Vashi'] && (
            <Path
              d={`M${lmPixels['BKC'].x} ${lmPixels['BKC'].y} L${lmPixels['Vashi'].x} ${lmPixels['Vashi'].y}`}
              fill="none"
              stroke="#f2efe4"
              strokeWidth="9"
              strokeLinecap="round"
            />
          )}

          {/* Arabian Sea coastal water on the Western edge */}
          {lmPixels['Colaba'] && lmPixels['Bandra'] && lmPixels['Borivali'] && (
            <Path
              d={`M-30 -20 L${lmPixels['Borivali'].x - 30} -20 L${lmPixels['Andheri'].x - 30} ${lmPixels['Andheri'].y} L${lmPixels['Bandra'].x - 26} ${lmPixels['Bandra'].y} L${lmPixels['Worli'].x - 22} ${lmPixels['Worli'].y} L${lmPixels['Colaba'].x - 18} ${lmPixels['Colaba'].y} L-30 ${mapLayout.height + 20} Z`}
              fill="#cbe3f2"
              opacity="0.8"
            />
          )}

          {/* Landmarks plotted dynamically at exact pixel coordinates */}
          {MAP_LANDMARKS.map((lm) => {
            const pos = lmPixels[lm.name];
            if (!pos || pos.x < -20 || pos.x > mapLayout.width + 20 || pos.y < -20 || pos.y > mapLayout.height + 20) {
              return null;
            }
            return (
              <G key={lm.name}>
                <Circle cx={pos.x} cy={pos.y} r={zoom <= 0.7 ? 5 : 6} fill="#ffffff" opacity={0.9} />
                <Circle cx={pos.x} cy={pos.y} r={zoom <= 0.7 ? 3 : 3.5} fill="#24543b" />
                <SvgText
                  x={pos.x}
                  y={pos.y + (zoom <= 0.7 ? 11 : 13)}
                  fontSize={zoom <= 0.7 ? 9 : 10}
                  fontWeight="700"
                  fill="#1b3d2b"
                  textAnchor="middle"
                  stroke="#ffffff"
                  strokeWidth="2"
                >
                  {lm.name}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Movable Pin */}
        <View
          style={[
            styles.pin,
            {
              left: pinLeftPercent,
              top: pinTopPercent,
            },
          ]}
        >
          <View style={styles.pinCallout}>
            <Text style={styles.pinCalloutTitle} numberOfLines={1}>
              {areaName || 'Shop Location'}
            </Text>
            <Text style={styles.pinCalloutCoords}>
              {coordinate.latitude.toFixed(3)}, {coordinate.longitude.toFixed(3)}
            </Text>
          </View>
          <View style={styles.pinHalo}>
            <View style={styles.pinDot}>
              <Feather name="map-pin" size={13} color="#ffffff" />
            </View>
          </View>
        </View>

        {/* Floating Zoom & Centering Controls Column */}
        <View style={styles.floatingZoomControls}>
          {onZoomIn && (
            <Pressable
              onPress={onZoomIn}
              style={styles.floatingZoomBtn}
              accessibilityRole="button"
              accessibilityLabel="Zoom In"
            >
              <Feather name="plus" size={17} color="#173b2d" />
            </Pressable>
          )}
          {onZoomIn && onZoomOut && <View style={styles.floatingZoomDivider} />}
          {onZoomOut && (
            <Pressable
              onPress={onZoomOut}
              style={styles.floatingZoomBtn}
              accessibilityRole="button"
              accessibilityLabel="Zoom Out"
            >
              <Feather name="minus" size={17} color="#173b2d" />
            </Pressable>
          )}
          {onZoomToAllMumbai && (
            <>
              <View style={styles.floatingZoomDivider} />
              <Pressable
                onPress={onZoomToAllMumbai}
                style={styles.floatingZoomBtn}
                accessibilityRole="button"
                accessibilityLabel="Zoom out to all Mumbai"
              >
                <Feather name="maximize-2" size={14} color="#173b2d" />
              </Pressable>
            </>
          )}
          {onCenterOnPin && (
            <>
              <View style={styles.floatingZoomDivider} />
              <Pressable
                onPress={onCenterOnPin}
                style={styles.floatingZoomBtn}
                accessibilityRole="button"
                accessibilityLabel="Center view on pin"
              >
                <Feather name="crosshair" size={15} color="#2b8253" />
              </Pressable>
            </>
          )}
        </View>

        {/* Floating Zoom Badge */}
        <View style={styles.floatingZoomBadge}>
          <Feather name={zoom <= 0.6 ? 'globe' : 'compass'} size={11} color="#173b2d" />
          <Text style={styles.floatingZoomBadgeText}>
            {zoom <= 0.6 ? 'All Mumbai (Zoomed Out)' : `${zoom.toFixed(1)}x · ${areaName || 'Mumbai'}`}
          </Text>
        </View>

        <View style={styles.mapTapHint}>
          <Feather name="mouse-pointer" size={11} color="#536d5b" />
          <Text style={styles.mapTapHintText}>Tap to pinpoint · +/− to zoom</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e8eddf',
  },
  touchArea: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  svgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  pin: {
    position: 'absolute',
    transform: [{ translateX: -18 }, { translateY: -40 }],
    alignItems: 'center',
    zIndex: 10,
  },
  pinCallout: {
    backgroundColor: '#173b2d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  pinCalloutTitle: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  pinCalloutCoords: {
    color: '#c4ddce',
    fontSize: 8,
    marginTop: 1,
  },
  pinHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(43, 130, 83, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2b8253',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  floatingZoomControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 20,
    overflow: 'hidden',
  },
  floatingZoomBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingZoomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4decb',
    width: '100%',
  },
  floatingZoomBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 20,
  },
  floatingZoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#173b2d',
  },
  mapTapHint: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 15,
  },
  mapTapHintText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#536d5b',
  },
});
