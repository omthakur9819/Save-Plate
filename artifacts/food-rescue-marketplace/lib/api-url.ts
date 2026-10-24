import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function getApiUrl(): string {
  // If explicitly configured with a non-localhost IP
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // On Web browser
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:5000`;
      }
    }
    if (envUrl) return envUrl;
    return 'http://localhost:5000';
  }

  // On Mobile Device (Android / iOS / Expo Go)
  // Extract host from Expo's debugger connection
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).experienceUrl;

  if (typeof hostUri === 'string' && hostUri) {
    const cleanHost = hostUri.replace(/^[a-zA-Z]+:\/\//, '').split(':')[0];
    if (cleanHost && cleanHost !== 'localhost' && cleanHost !== '127.0.0.1') {
      return `http://${cleanHost}:5000`;
    }
  }

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // Developer local Wi-Fi IP address
  return 'http://172.16.227.165:5000';
}
