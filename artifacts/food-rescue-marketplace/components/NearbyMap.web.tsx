import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { NearbyMapProps } from '@/components/NearbyMap.types';
import { useColors } from '@/hooks/useColors';

const markerPositions = [
  { left: '21%', top: '37%' },
  { left: '60%', top: '27%' },
  { left: '41%', top: '64%' },
  { left: '78%', top: '71%' },
] as const;

export default function NearbyMap({ items, onMarkerPress }: NearbyMapProps) {
  const colors = useColors();
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
      {items.slice(0, 4).map((item, index) => {
        const point = markerPositions[index % markerPositions.length];
        return (
          <Pressable
            key={item.id}
            onPress={() => onMarkerPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name} on the map`}
            style={[styles.marker, { left: point.left, top: point.top }]}
            testID={`map-marker-${item.id}`}
          >
            <View style={[styles.markerHalo, { backgroundColor: `${colors.primary}36` }]}>
              <View style={[styles.markerDot, { backgroundColor: colors.primary }]}>
                <Feather name="shopping-bag" size={11} color={colors.primaryForeground} />
              </View>
            </View>
          </Pressable>
        );
      })}
      <View style={[styles.mapLabel, { backgroundColor: colors.card }]}>
        <Feather name="map-pin" size={12} color={colors.primary} />
        <Text style={[styles.mapLabelText, { color: colors.foreground }]}>Bandra West</Text>
      </View>
      <View style={styles.schematicNote}>
        <Text style={styles.schematicNoteText}>NEIGHBORHOOD PREVIEW</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 290, marginHorizontal: 16, borderRadius: 23, overflow: 'hidden' },
  marker: { position: 'absolute', transform: [{ translateX: -16 }, { translateY: -16 }] },
  markerHalo: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  markerDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  mapLabel: { position: 'absolute', left: 9, bottom: 9, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14 },
  mapLabelText: { fontSize: 11, fontWeight: '700' },
  schematicNote: { position: 'absolute', right: 9, top: 9, backgroundColor: 'rgba(255,255,255,0.76)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  schematicNoteText: { color: '#536d5b', fontSize: 8, letterSpacing: 0.7, fontWeight: '800' },
});
