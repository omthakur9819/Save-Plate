import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { NearbyMapProps } from '@/components/NearbyMap.types';

const defaultRegion: Region = {
  latitude: 19.0595,
  longitude: 72.8315,
  latitudeDelta: 0.023,
  longitudeDelta: 0.023,
};

export default function NearbyMap({
  items,
  onMarkerPress,
  center,
  showUserLocation,
  selectedId,
  onSelectMarker,
}: NearbyMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (center) {
      mapRef.current?.animateToRegion(
        { ...center, latitudeDelta: 0.018, longitudeDelta: 0.018 },
        500,
      );
    }
  }, [center]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={defaultRegion}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={showUserLocation}
      accessibilityLabel="Map of nearby pickup offers"
    >
      {items.map((item) => (
        <Marker
          key={item.id}
          coordinate={{ latitude: item.latitude, longitude: item.longitude }}
          title={`${item.name} · ₹${item.price}${item.isMine ? ' (Your Offer)' : ''}`}
          description={`${item.vendor} · ${item.area}`}
          onPress={() => {
            onSelectMarker?.(item);
            onMarkerPress(item);
          }}
          pinColor={item.isMine ? '#2b8253' : (item.id === selectedId ? '#e2764d' : undefined)}
          testID={`map-marker-${item.id}`}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 290, marginHorizontal: 16, borderRadius: 23, overflow: 'hidden' },
});
