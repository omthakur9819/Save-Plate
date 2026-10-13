import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { LocationPickerMapProps } from './LocationPickerMap.types';

export default function LocationPickerMap({
  coordinate,
  onCoordinateChange,
  areaName,
  center,
  zoom = 1.0,
}: LocationPickerMapProps) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (center && mapRef.current) {
      const latDelta = Math.max(0.006, 0.12 / zoom);
      const lngDelta = Math.max(0.006, 0.12 / zoom);
      mapRef.current.animateToRegion(
        {
          latitude: center.latitude,
          longitude: center.longitude,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        },
        350,
      );
    }
  }, [center, zoom]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e) => {
          if (e.nativeEvent && e.nativeEvent.coordinate) {
            onCoordinateChange(e.nativeEvent.coordinate);
          }
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        showsScale={true}
      >
        <Marker
          coordinate={coordinate}
          draggable
          title={areaName || 'Shop Location'}
          description="Drag pin or tap anywhere to place"
          pinColor="#2b8253"
          onDragEnd={(e) => {
            if (e.nativeEvent && e.nativeEvent.coordinate) {
              onCoordinateChange(e.nativeEvent.coordinate);
            }
          }}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
