export interface LocationPickerMapProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  onCoordinateChange: (coordinate: { latitude: number; longitude: number }, areaName?: string) => void;
  areaName?: string;
  zoom?: number;
  center?: {
    latitude: number;
    longitude: number;
  };
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomToAllMumbai?: () => void;
  onCenterOnPin?: () => void;
}
