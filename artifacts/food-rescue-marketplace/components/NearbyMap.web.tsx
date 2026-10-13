import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { NearbyMapProps } from '@/components/NearbyMap.types';
import { useColors } from '@/hooks/useColors';

const DEFAULT_POSITIONS = [
  { left: '24%', top: '38%' },
  { left: '62%', top: '28%' },
  { left: '42%', top: '65%' },
  { left: '76%', top: '68%' },
  { left: '32%', top: '78%' },
  { left: '80%', top: '35%' },
] as const;

export default function NearbyMap({
  items,
  onMarkerPress,
  selectedId,
  onSelectMarker,
}: NearbyMapProps) {
  const colors = useColors();

  const markerPositions = useMemo(() => {
    if (items.length === 0) return [];
    if (items.length === 1) return [{ left: '50%', top: '50%' }];

    const lats = items.map((i) => i.latitude);
    const lngs = items.map((i) => i.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(maxLat - minLat, 0.012);
    const lngSpan = Math.max(maxLng - minLng, 0.012);

    return items.map((item, idx) => {
      if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
        return DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length];
      }
      const normX = (item.longitude - minLng) / lngSpan;
      const leftVal = Math.min(84, Math.max(16, 18 + normX * 64));

      const normY = (item.latitude - minLat) / latSpan;
      const topVal = Math.min(80, Math.max(24, 80 - normY * 56));

      return {
        left: `${leftVal.toFixed(1)}%`,
        top: `${topVal.toFixed(1)}%`,
      };
    });
  }, [items]);

  const activeAreaLabel = useMemo(() => {
    if (items.length === 0) return 'No results';
    if (selectedId) {
      const sel = items.find((i) => i.id === selectedId);
      if (sel) return sel.area;
    }
    return items[0]?.area || 'Mumbai';
  }, [items, selectedId]);

  return (
    <View style={[styles.map, { backgroundColor: '#e8eddf' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 280" preserveAspectRatio="xMidYMid slice">
        <Rect width="360" height="280" fill="#e8eddf" />
        <Path d="M-20 54 C58 66 88 25 166 46 S276 75 390 24" fill="none" stroke="#f8f6ee" strokeWidth="20" />
        <Path d="M-30 144 C50 125 95 163 170 139 S278 111 390 149" fill="none" stroke="#f8f6ee" strokeWidth="16" />
        <Path d="M-22 239 C53 218 106 250 177 226 S292 206 382 230" fill="none" stroke="#f8f6ee" strokeWidth="18" />
        <Path d="M70 -22 C85 44 46 79 80 141 S97 215 77 302" fill="none" stroke="#faf8f2" strokeWidth="13" />
        <Path d="M183 -22 C153 38 208 86 178 140 S155 223 190 300" fill="none" stroke="#faf8f2" strokeWidth="13" />
        <Path d="M309 -20 C281 37 330 92 294 151 S286 221 321 303" fill="none" stroke="#faf8f2" strokeWidth="13" />
        <Path d="M-8 96 L368 198 M-5 187 L359 83" fill="none" stroke="#d4decb" strokeWidth="1.5" />
        <Circle cx="180" cy="141" r="11" fill="#457b5c" opacity="0.18" />
        <Circle cx="180" cy="141" r="5" fill="#457b5c" />
      </Svg>

      {items.map((item, index) => {
        const point = markerPositions[index] || DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
        const isSelected = selectedId === item.id;

        return (
          <Pressable
            key={item.id}
            onPress={() => {
              if (onSelectMarker) {
                onSelectMarker(item);
              } else {
                onMarkerPress(item);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name} on the map`}
            style={[
              styles.marker,
              {
                left: point.left as DimensionValue,
                top: point.top as DimensionValue,
                zIndex: isSelected ? 30 : 10,
              },
            ]}
            testID={`map-marker-${item.id}`}
          >
            {isSelected && (
              <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.tooltipVendor, { color: colors.foreground }]} numberOfLines={1}>
                  {item.vendor}
                </Text>
                <Text style={[styles.tooltipPrice, { color: colors.primary }]} numberOfLines={1}>
                  ₹{item.price} · {item.name}
                </Text>
                <View style={[styles.tooltipArrow, { borderTopColor: colors.card }]} />
              </View>
            )}

            <View
              style={[
                styles.markerHalo,
                { backgroundColor: `${colors.primary}36` },
                isSelected && styles.markerHaloSelected,
              ]}
            >
              <View
                style={[
                  styles.markerDot,
                  { backgroundColor: colors.primary },
                  isSelected && styles.markerDotSelected,
                ]}
              >
                <Feather
                  name="shopping-bag"
                  size={isSelected ? 13 : 11}
                  color={colors.primaryForeground}
                />
              </View>
            </View>
          </Pressable>
        );
      })}

      {items.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Feather name="search" size={18} color="#7c877c" />
          <Text style={styles.emptyOverlayText}>No spots match your search</Text>
        </View>
      )}

      <View style={[styles.mapLabel, { backgroundColor: colors.card }]}>
        <Feather name="map-pin" size={12} color={colors.primary} />
        <Text style={[styles.mapLabelText, { color: colors.foreground }]}>{activeAreaLabel}</Text>
      </View>
      <View style={styles.schematicNote}>
        <Text style={styles.schematicNoteText}>
          {items.length} {items.length === 1 ? 'SPOT' : 'SPOTS'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 290, marginHorizontal: 16, borderRadius: 23, overflow: 'hidden' },
  marker: { position: 'absolute', transform: [{ translateX: -16 }, { translateY: -16 }] },
  markerHalo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markerHaloSelected: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(226, 118, 77, 0.45)', transform: [{ translateX: -5 }, { translateY: -5 }] },
  markerDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  markerDotSelected: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5 },
  tooltip: {
    position: 'absolute',
    bottom: 38,
    left: '50%',
    transform: [{ translateX: -70 }],
    width: 140,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
  },
  tooltipVendor: { fontSize: 10, fontWeight: '700' },
  tooltipPrice: { fontSize: 9, fontWeight: '600', marginTop: 1 },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: [{ translateX: -5 }],
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(232, 237, 223, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#536d5b',
  },
  mapLabel: { position: 'absolute', left: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14 },
  mapLabelText: { fontSize: 11, fontWeight: '700' },
  schematicNote: { position: 'absolute', right: 9, top: 9, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  schematicNoteText: { color: '#536d5b', fontSize: 8, letterSpacing: 0.7, fontWeight: '800' },
});
