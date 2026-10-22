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

export default function VectorMap({
  items,
  onMarkerPress,
  selectedId,
  onSelectMarker,
  routeDestination,
  routeEstimate,
  isRoutingLoading,
  travelMode = 'driving',
  onChangeTravelMode,
  onClearRoute,
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

    const positions: Array<{ left: string; top: string }> = [];

    items.forEach((item, idx) => {
      if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
        positions.push(DEFAULT_POSITIONS[idx % DEFAULT_POSITIONS.length]);
        return;
      }
      const normX = (item.longitude - minLng) / lngSpan;
      let leftVal = Math.min(84, Math.max(16, 18 + normX * 64));

      const normY = (item.latitude - minLat) / latSpan;
      let topVal = Math.min(80, Math.max(24, 80 - normY * 56));

      // Prevent overlapping markers at the same spot
      let attempts = 0;
      while (attempts < 8) {
        const tooClose = positions.some((p) => {
          const pLeft = parseFloat(p.left);
          const pTop = parseFloat(p.top);
          return Math.abs(pLeft - leftVal) < 6.5 && Math.abs(pTop - topVal) < 6.5;
        });
        if (tooClose) {
          const angle = (attempts * Math.PI) / 4;
          leftVal = Math.min(84, Math.max(16, leftVal + Math.cos(angle) * 7.5));
          topVal = Math.min(80, Math.max(24, topVal + Math.sin(angle) * 7.5));
          attempts++;
        } else {
          break;
        }
      }

      positions.push({
        left: `${leftVal.toFixed(1)}%`,
        top: `${topVal.toFixed(1)}%`,
      });
    });

    return positions;
  }, [items]);

  const activeAreaLabel = useMemo(() => {
    if (items.length === 0) return 'No results';
    if (selectedId) {
      const sel = items.find((i) => i.id === selectedId);
      if (sel) return sel.area;
    }
    return items[0]?.area || 'Mumbai';
  }, [items, selectedId]);

  // Find coordinate of destination if routing
  const routeDestPos = useMemo(() => {
    if (!routeDestination) return null;
    const idx = items.findIndex((i) => i.id === routeDestination.id);
    if (idx !== -1 && markerPositions[idx]) {
      const leftP = parseFloat(markerPositions[idx].left);
      const topP = parseFloat(markerPositions[idx].top);
      return { x: (leftP / 100) * 360, y: (topP / 100) * 280 };
    }
    return { x: 280, y: 100 };
  }, [routeDestination, items, markerPositions]);

  return (
    <View style={styles.containerWrapper}>
      {/* Route Header Card */}
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
          {routeEstimate && (
            <View style={styles.routeMetricsRow}>
              <View style={styles.etaContainer}>
                <Text style={styles.etaValue}>{routeEstimate.etaText}</Text>
                <Text style={styles.etaDistance}>({routeEstimate.distanceText})</Text>
              </View>

              <View style={styles.arrivalContainer}>
                <View style={styles.greenDot} />
                <Text style={styles.arrivalText}>Arrive by {routeEstimate.arrivalTime}</Text>
              </View>

              <View
                style={[
                  styles.aStarBadge,
                  routeEstimate.method === 'osrm-realtime' ? styles.osrmBadge : styles.aStarBadgeFallback,
                ]}
              >
                <View
                  style={[
                    styles.methodDot,
                    { backgroundColor: routeEstimate.method === 'osrm-realtime' ? '#16a34a' : '#d97706' },
                  ]}
                />
                <Text
                  style={[
                    styles.aStarBadgeText,
                    { color: routeEstimate.method === 'osrm-realtime' ? '#15803d' : '#b45309' },
                  ]}
                >
                  {routeEstimate.method === 'osrm-realtime' ? 'OSRM REAL ROADS' : 'A* ESTIMATE'}
                </Text>
              </View>
            </View>
          )}

          {/* Travel Mode Selector */}
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
              accessibilityLabel="Bike route"
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
          </View>
        </View>
      )}

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

          {/* User Location Center Pin */}
          <Circle cx="180" cy="141" r="14" fill="#2563eb" opacity="0.2" />
          <Circle cx="180" cy="141" r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />

          {/* Dynamic Route Line from User Location to Destination */}
          {routeDestPos && (
            <>
              <Path
                d={`M180 141 Q${(180 + routeDestPos.x) / 2 + 15} ${(141 + routeDestPos.y) / 2 - 20} ${routeDestPos.x} ${routeDestPos.y}`}
                fill="none"
                stroke="#2563eb"
                strokeWidth="4"
                strokeDasharray="6,4"
              />
              <Circle cx={routeDestPos.x} cy={routeDestPos.y} r="8" fill="#e2764d" stroke="#ffffff" strokeWidth="2" />
            </>
          )}
        </Svg>


      {items.map((item, index) => {
        const point = markerPositions[index] || DEFAULT_POSITIONS[index % DEFAULT_POSITIONS.length];
        const isSelected = selectedId === item.id;
        const isMine = !!item.isMine;

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
                zIndex: isSelected ? 30 : (isMine ? 20 : 10),
              },
            ]}
            testID={`map-marker-${item.id}`}
          >
            {isSelected && (
              <View style={[styles.tooltip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.tooltipHeader}>
                  <Text style={[styles.tooltipVendor, { color: colors.foreground }]} numberOfLines={1}>
                    {item.vendor}
                  </Text>
                  {isMine && (
                    <View style={styles.mineTag}>
                      <Text style={styles.mineTagText}>YOURS</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tooltipPrice, { color: isMine ? '#2b8253' : colors.primary }]} numberOfLines={1}>
                  ₹{item.price} · {item.name}
                </Text>
                <View style={[styles.tooltipArrow, { borderTopColor: colors.card }]} />
              </View>
            )}

            <View
              style={[
                styles.markerHalo,
                { backgroundColor: isMine ? 'rgba(43, 130, 83, 0.28)' : `${colors.primary}36` },
                isSelected && (isMine ? styles.markerHaloSelectedMine : styles.markerHaloSelected),
              ]}
            >
              <View
                style={[
                  styles.markerDot,
                  { backgroundColor: isMine ? '#2b8253' : colors.primary },
                  isSelected && styles.markerDotSelected,
                ]}
              >
                <Feather
                  name={isMine ? 'star' : 'shopping-bag'}
                  size={isSelected ? 13 : 11}
                  color="#ffffff"
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
    </View>
  );
}

const styles = StyleSheet.create({
  containerWrapper: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  osrmBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  aStarBadgeFallback: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  methodDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  aStarBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  map: { height: 280, width: '100%', position: 'relative' },
  marker: { position: 'absolute', transform: [{ translateX: -16 }, { translateY: -16 }] },
  markerHalo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markerHaloSelected: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(226, 118, 77, 0.45)', transform: [{ translateX: -5 }, { translateY: -5 }] },
  markerHaloSelectedMine: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(43, 130, 83, 0.45)', transform: [{ translateX: -5 }, { translateY: -5 }] },
  markerDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  markerDotSelected: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5 },
  tooltip: {
    position: 'absolute',
    bottom: 38,
    left: '50%',
    transform: [{ translateX: -75 }],
    width: 150,
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
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tooltipVendor: { fontSize: 10, fontWeight: '700' },
  mineTag: {
    backgroundColor: '#2b8253',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mineTagText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
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
