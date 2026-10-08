import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { NearbyMapProps } from '@/components/NearbyMap.types';

const defaultRegion: Region = {
  latitude: 37.775,
  longitude: -122.423,
  latitudeDelta: 0.023,
  longitudeDelta: 0.023,
};

export default function NearbyMap({
  items,
  onMarkerPress,
  center,
  showUserLocation,
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
          title={`$${item.price} · ${item.name}`}
          description={`${item.vendor} · ${item.area}`}
          onPress={() => onMarkerPress(item)}
          testID={`map-marker-${item.id}`}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 290, marginHorizontal: 16, borderRadius: 23, overflow: 'hidden' },
});
