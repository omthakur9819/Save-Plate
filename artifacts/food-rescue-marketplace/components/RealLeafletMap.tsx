import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { NearbyMapProps } from './NearbyMap.types';
import VectorMap from './VectorMap';

export default function RealLeafletMap({
  items,
  onMarkerPress,
  center,
  userLocation,
  selectedId,
  onSelectMarker,
  onLocateMe,
}: NearbyMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasError, setHasError] = useState(false);

  // Initial center coordinates (Default to Mumbai Bandra/BKC or provided center)
  const initialCenter = useMemo(() => {
    if (center) return center;
    if (userLocation) return userLocation;
    if (items.length > 0 && items[0].latitude && items[0].longitude) {
      return { latitude: items[0].latitude, longitude: items[0].longitude };
    }
    return { latitude: 19.0595, longitude: 72.8315 };
  }, []);

  // HTML content injected into the WebView
  const htmlContent = useMemo(() => {
    const serializedItems = JSON.stringify(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        vendor: i.vendor,
        area: i.area,
        latitude: i.latitude,
        longitude: i.longitude,
        isMine: !!i.isMine,
      })),
    );

    const initialUserLoc = userLocation ? JSON.stringify(userLocation) : 'null';

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
    
    .custom-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
    }
    .marker-badge {
      background: #173b2d;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 3px 8px rgba(0,0,0,0.3);
      border: 1.5px solid #ffffff;
      margin-bottom: 2px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: all 0.2s ease;
    }
    .marker-badge.mine {
      background: #2b8253;
    }
    .marker-badge.selected {
      background: #e2764d;
      transform: scale(1.15);
      box-shadow: 0 4px 12px rgba(226, 118, 77, 0.45);
    }
    .marker-pin {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #e2764d;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 5px rgba(0,0,0,0.35);
    }
    .marker-pin.mine {
      background: #2b8253;
    }

    /* Pulsing Blue User Location Dot */
    .user-location-wrap {
      position: relative;
      width: 24px;
      height: 24px;
    }
    .user-dot {
      width: 16px;
      height: 16px;
      background: #2563eb;
      border: 3px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(0,0,0,0.45);
      position: absolute;
      top: 4px;
      left: 4px;
      z-index: 100;
    }
    .user-pulse {
      position: absolute;
      width: 36px;
      height: 36px;
      top: -6px;
      left: -6px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.35);
      animation: pulseRing 2s infinite ease-out;
    }
    @keyframes pulseRing {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    /* Locate Me Floating Button */
    .locate-btn {
      position: absolute;
      bottom: 16px;
      right: 14px;
      z-index: 1000;
      width: 44px;
      height: 44px;
      background: #ffffff;
      border-radius: 22px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.28);
      border: 1px solid rgba(0,0,0,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      outline: none;
    }
    .locate-btn:active {
      transform: scale(0.92);
      background: #f0fdf4;
    }

    .leaflet-control-zoom {
      border: none !important;
      box-shadow: 0 3px 8px rgba(0,0,0,0.2) !important;
      border-radius: 12px !important;
      overflow: hidden;
      margin-top: 14px !important;
      margin-right: 14px !important;
    }
    .leaflet-control-zoom a {
      background: #ffffff !important;
      color: #173b2d !important;
      font-weight: 700 !important;
      width: 34px !important;
      height: 34px !important;
      line-height: 34px !important;
    }
    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255,255,255,0.7) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button class="locate-btn" id="locateBtn" title="Locate Me">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b8253" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="22" y1="12" x2="18" y2="12"></line>
      <line x1="6" y1="12" x2="2" y2="12"></line>
      <line x1="12" y1="6" x2="12" y2="2"></line>
      <line x1="12" y1="22" x2="12" y2="18"></line>
    </svg>
  </button>

  <script>
    var items = ${serializedItems};
    var selectedId = ${selectedId ? `'${selectedId}'` : 'null'};
    var userLocation = ${initialUserLoc};

    // Initialize Map with CartoDB Voyager tiles (crisp modern street map)
    var map = L.map('map', {
      center: [${initialCenter.latitude}, ${initialCenter.longitude}],
      zoom: 13,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    var markersMap = {};
    var userMarker = null;

    function renderMarkers() {
      // Clear existing markers
      Object.keys(markersMap).forEach(function(k) {
        map.removeLayer(markersMap[k]);
      });
      markersMap = {};

      items.forEach(function(item) {
        if (!item.latitude || !item.longitude) return;

        var isSel = (item.id === selectedId);
        var isMine = item.isMine;

        var html = '<div class="custom-marker" data-id="' + item.id + '">' +
          '<div class="marker-badge ' + (isMine ? 'mine ' : '') + (isSel ? 'selected' : '') + '">' +
            '₹' + item.price +
          '</div>' +
          '<div class="marker-pin ' + (isMine ? 'mine' : '') + '"></div>' +
        '</div>';

        var icon = L.divIcon({
          className: '',
          html: html,
          iconSize: [60, 42],
          iconAnchor: [30, 42]
        });

        var m = L.marker([item.latitude, item.longitude], { icon: icon }).addTo(map);
        m.on('click', function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'markerPress',
              id: item.id
            }));
          }
        });

        markersMap[item.id] = m;
      });
    }

    function renderUserLocation() {
      if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
      }
      if (!userLocation || !userLocation.latitude || !userLocation.longitude) return;

      var html = '<div class="user-location-wrap">' +
        '<div class="user-pulse"></div>' +
        '<div class="user-dot"></div>' +
      '</div>';

      var icon = L.divIcon({
        className: '',
        html: html,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      userMarker = L.marker([userLocation.latitude, userLocation.longitude], {
        icon: icon,
        zIndexOffset: 1000
      }).addTo(map);
    }

    renderMarkers();
    renderUserLocation();

    // Setup Locate Me Button
    document.getElementById('locateBtn').addEventListener('click', function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'locateMe' }));
      }
    });

    // Window API for updates from React Native
    window.updateItems = function(newItems, newSelectedId) {
      items = newItems;
      selectedId = newSelectedId;
      renderMarkers();
    };

    window.updateUserLocation = function(coords, autoPan) {
      userLocation = coords;
      renderUserLocation();
      if (autoPan && coords && coords.latitude) {
        map.flyTo([coords.latitude, coords.longitude], 15, { animate: true, duration: 0.8 });
      }
    };

    window.flyTo = function(lat, lng, zoomLevel) {
      map.flyTo([lat, lng], zoomLevel || 15, { animate: true, duration: 0.8 });
    };

    window.selectMarker = function(id) {
      selectedId = id;
      renderMarkers();
      if (markersMap[id]) {
        var ll = markersMap[id].getLatLng();
        map.flyTo([ll.lat, ll.lng], 15, { animate: true, duration: 0.6 });
      }
    };
  </script>
</body>
</html>
    `;
  }, [initialCenter]);

  // Handle incoming messages from WebView
  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerPress') {
        const item = items.find((i) => i.id === data.id);
        if (item) {
          onSelectMarker?.(item);
          onMarkerPress(item);
        }
      } else if (data.type === 'locateMe') {
        onLocateMe?.();
      }
    } catch {}
  };

  // Sync center changes
  useEffect(() => {
    if (center && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.flyTo) { window.flyTo(${center.latitude}, ${center.longitude}); } true;`,
      );
    }
  }, [center]);

  // Sync userLocation changes
  useEffect(() => {
    if (userLocation && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.updateUserLocation) { window.updateUserLocation(${JSON.stringify(userLocation)}, true); } true;`,
      );
    }
  }, [userLocation]);

  // Sync selectedId changes
  useEffect(() => {
    if (selectedId && webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.selectMarker) { window.selectMarker('${selectedId}'); } true;`,
      );
    }
  }, [selectedId]);

  if (hasError) {
    return (
      <VectorMap
        items={items}
        onMarkerPress={onMarkerPress}
        center={center}
        showUserLocation={true}
        selectedId={selectedId}
        onSelectMarker={onSelectMarker}
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
    height: 310,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#e8eddf',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  webView: {
    flex: 1,
    backgroundColor: '#e8eddf',
  },
});
