import React from 'react';
import GoogleMapsLocationPickerWebView from '@/components/GoogleMapsLocationPickerWebView';
import { LocationPickerMapProps } from './LocationPickerMap.types';

export default function LocationPickerMap(props: LocationPickerMapProps) {
  return <GoogleMapsLocationPickerWebView {...props} />;
}
