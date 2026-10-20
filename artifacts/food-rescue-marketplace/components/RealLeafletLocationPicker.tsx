import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MUMBAI_NEIGHBORHOOD_COORDS } from '@/context/MarketplaceContext';
import { LocationPickerMapProps } from './LocationPickerMap.types';
import VectorLocationPickerMap from './VectorLocationPickerMap';

export default function RealLeafletLocationPicker({
  coordinate,
  onCoordinateChange,
  areaName,
  center,
  zoom = 1.0,
}: LocationPickerMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);

  const initialCenter = useMemo(() => {
    if (center) return center;
    return coordinate;
  }, []);

  const htmlContent = useMemo(() => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #e8eddf; }

    .picker-pin {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: grab;
    }
    .picker-pin-callout {
      background: #173b2d;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 8px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      margin-bottom: 2px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .picker-pin-dot {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #2b8253;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .locate-btn {
      position: absolute;
      bottom: 14px;
      right: 12px;
      z-index: 1000;
      width: 40px;
      height: 40px;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.25);
      border: 1px solid rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .locate-btn:active {
      transform: scale(0.92);
      background: #f0fdf4;
    }
    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
      border-radius: 10px !important;
      overflow: hidden;
      margin-top: 10px !important;
      margin-right: 10px !important;
    }
    .leaflet-control-zoom a {
      width: 30px !important;
      height: 30px !important;
      line-height: 30px !important;
      font-weight: 700 !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="locate-btn" id="locateBtn" title="Pin My Current Location">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2b8253" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="22" y1="12" x2="18" y2="12"></line>
      <line x1="6" y1="12" x2="2" y2="12"></line>
      <line x1="12" y1="6" x2="12" y2="2"></line>
      <line x1="12" y1="22" x2="12" y2="18"></line>
    </svg>
  </button>

  <script>
    var currentCoord = { lat: ${coordinate.latitude}, lng: ${coordinate.longitude} };
    var currentArea = "${areaName || 'Shop Location'}";

    var map = L.map('map', {
      center: [${initialCenter.latitude}, ${initialCenter.longitude}],
      zoom: 14,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    function createPinIcon(label) {
      return L.divIcon({
        className: '',
        html: '<div class="picker-pin">' +
          '<div class="picker-pin-callout">' + label + '</div>' +
          '<div class="picker-pin-dot">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' +
          '</div>' +
        '</div>',
        iconSize: [120, 48],
        iconAnchor: [60, 48]
      });
    }

    var marker = L.marker([currentCoord.lat, currentCoord.lng], {
      draggable: true,
      icon: createPinIcon(currentArea)
    }).addTo(map);

    function notifyCoordChange(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'coordChange',
          latitude: Number(lat.toFixed(5)),
          longitude: Number(lng.toFixed(5))
        }));
      }
    }

    marker.on('dragend', function(e) {
      var pos = marker.getLatLng();
      notifyCoordChange(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      marker.setLatLng(e.latlng);
      notifyCoordChange(e.latlng.lat, e.latlng.lng);
    });

    document.getElementById('locateBtn').addEventListener('click', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'locateMe' }));
      }
    });

    window.updatePin = function(lat, lng, label) {
      marker.setLatLng([lat, lng]);
      marker.setIcon(createPinIcon(label || 'Shop Location'));
      map.panTo([lat, lng]);
    };
  </script>
</body>
</html>
    `;
  }, []);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'coordChange') {
        const newCoords = { latitude: data.latitude, longitude: data.longitude };

        // Find nearest Mumbai area name
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

        // Query reverse geocoding
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.latitude}&lon=${newCoords.longitude}&zoom=16&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } },
          );
          if (res.ok) {
            const geodata = await res.json();
            const addr = geodata.address;
            const placeName =
              addr?.neighbourhood ||
              addr?.suburb ||
              addr?.residential ||
              addr?.road ||
              addr?.city_district ||
              closestName;
            if (placeName && placeName !== closestName) {
              onCoordinateChange(newCoords, placeName);
            }
          }
        } catch {}
      } else if (data.type === 'locateMe') {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const newCoords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          onCoordinateChange(newCoords, 'My Current Location');
          webViewRef.current?.injectJavaScript(
            `if (window.updatePin) { window.updatePin(${newCoords.latitude}, ${newCoords.longitude}, 'My Current Location'); } true;`,
          );
          Haptics.selectionAsync();
        } catch {}
      }
    } catch {}
  };

  useEffect(() => {
    if (center && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.updatePin) { window.updatePin(${center.latitude}, ${center.longitude}, '${areaName || 'Shop Location'}'); } true;`,
      );
    }
  }, [center, areaName]);

  if (hasError) {
    return (
      <VectorLocationPickerMap
        coordinate={coordinate}
        onCoordinateChange={onCoordinateChange}
        areaName={areaName}
        center={center}
        zoom={zoom}
      />
    );
  }

  const AnyWebView = WebView as any;

  return (
    <View style={styles.container}>
      <AnyWebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webView}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        onError={() => setHasError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e8eddf',
  },
  webView: {
    flex: 1,
    backgroundColor: '#e8eddf',
  },
});
