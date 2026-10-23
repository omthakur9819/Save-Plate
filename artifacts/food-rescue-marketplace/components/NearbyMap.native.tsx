import React from 'react';
import GoogleMapsWebView from '@/components/GoogleMapsWebView';
import { NearbyMapProps } from '@/components/NearbyMap.types';

export default function NearbyMap(props: NearbyMapProps) {
  return <GoogleMapsWebView {...props} />;
}

