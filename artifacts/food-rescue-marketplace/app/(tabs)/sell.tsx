import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DimensionValue,
  Image,
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import LocationPickerMap from '@/components/LocationPickerMap';
import {
  FoodCategory,
  getCoordinatesForArea,
  ListingPhoto,
  MUMBAI_NEIGHBORHOOD_COORDS,
  POPULAR_MUMBAI_AREAS,
  useMarketplace,
} from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';

const PRESET_FOOD_PHOTOS = [
  { label: '🥐 Bakery & Pastry', uri: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { label: '🍱 Fresh Meal Box', uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80' },
  { label: '🥪 Artisan Sandwich', uri: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80' },
  { label: '🍰 Dessert / Sweets', uri: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80' },
] as const;

export const DIETARY_CHOICES = [
  { id: 'vegetarian', label: '🌱 Vegetarian' },
  { id: 'vegan', label: '🌿 Vegan' },
  { id: 'egg_free', label: '🥚 Egg-Free' },
  { id: 'jain', label: '✨ Jain' },
  { id: 'halal', label: '☪️ Halal' },
] as const;

export const ALLERGEN_CHOICES = [
  { id: 'milk', label: '🥛 Milk/Dairy' },
  { id: 'egg', label: '🥚 Egg' },
  { id: 'peanuts', label: '🥜 Peanuts' },
  { id: 'tree_nuts', label: '🌰 Tree Nuts' },
  { id: 'gluten', label: '🌾 Gluten/Wheat' },
  { id: 'soy', label: '🫘 Soy' },
  { id: 'fish', label: '🐟 Fish' },
  { id: 'shellfish', label: '🦐 Shellfish' },
  { id: 'sesame', label: '🌱 Sesame' },
  { id: 'mustard', label: '🌿 Mustard' },
] as const;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  prefix?: string;
  testID: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType ?? 'default'}
          style={[styles.input, { color: colors.foreground }]}
          testID={testID}
        />
      </View>
    </View>
  );
}

const REGION_PRESETS = [
  { label: '🗺️ All Mumbai (Zoom Out)', name: 'Mumbai Metro', lat: 19.080, lng: 72.880, zoom: 0.5 },
  { label: '📍 Bandra & Suburbs', name: 'Bandra West', lat: 19.0596, lng: 72.8295, zoom: 1.2 },
  { label: '🏙️ South Mumbai (Colaba)', name: 'Colaba', lat: 18.9100, lng: 72.8180, zoom: 1.2 },
  { label: '🏢 BKC & Kurla', name: 'BKC', lat: 19.0657, lng: 72.8687, zoom: 1.3 },
  { label: '🏖️ Juhu & Andheri', name: 'Juhu', lat: 19.1150, lng: 72.8350, zoom: 1.2 },
  { label: '🌲 Powai & Central', name: 'Powai', lat: 19.1176, lng: 72.9060, zoom: 1.2 },
  { label: '🚆 Borivali (North)', name: 'Borivali', lat: 19.2307, lng: 72.8567, zoom: 1.2 },
  { label: '🌉 Thane & Navi Mumbai', name: 'Thane', lat: 19.2183, lng: 72.9781, zoom: 1.1 },
] as const;

const MAP_LANDMARKS = [
  { name: 'Colaba', lat: 18.9067, lng: 72.8147 },
  { name: 'Worli', lat: 19.0166, lng: 72.8166 },
  { name: 'Dadar', lat: 19.0178, lng: 72.8478 },
  { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
  { name: 'BKC', lat: 19.0657, lng: 72.8687 },
  { name: 'Juhu', lat: 19.1075, lng: 72.8263 },
  { name: 'Andheri', lat: 19.1197, lng: 72.8464 },
  { name: 'Powai', lat: 19.1176, lng: 72.9060 },
  { name: 'Borivali', lat: 19.2307, lng: 72.8567 },
  { name: 'Thane', lat: 19.2183, lng: 72.9781 },
  { name: 'Vashi', lat: 19.0771, lng: 72.9986 },
];

export default function VendorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, mode, setMode, addListing, currentUser } = useMarketplace();

  const [name, setName] = useState('');
  const [vendor, setVendor] = useState(
    currentUser?.role === 'vendor' ? (currentUser.restaurantName || currentUser.name) : '',
  );
  const [category, setCategory] = useState<FoodCategory>('Bakery');
  const [area, setArea] = useState(currentUser?.area || 'Bandra West');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number }>(() =>
    getCoordinatesForArea(currentUser?.area || 'Bandra West'),
  );

  useEffect(() => {
    if (currentUser?.role === 'vendor') {
      if (currentUser.restaurantName) {
        setVendor(currentUser.restaurantName);
      }
      if (currentUser.area) {
        setArea(currentUser.area);
        const coords = getCoordinatesForArea(currentUser.area);
        setCoordinates(coords);
        setPickerCoords(coords);
        setPickerCenter(coords);
        setPickerAreaName(currentUser.area);
      }
    }
  }, [currentUser]);
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pickupWindow, setPickupWindow] = useState('Today, 5:00–6:00 PM');

  // Address search & map picker modal state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCoords, setPickerCoords] = useState<{ latitude: number; longitude: number }>(() =>
    getCoordinatesForArea('Bandra West'),
  );
  const [pickerAreaName, setPickerAreaName] = useState('Bandra West');
  const [pickerZoom, setPickerZoom] = useState(1.0);
  const [pickerCenter, setPickerCenter] = useState<{ latitude: number; longitude: number }>(() =>
    getCoordinatesForArea('Bandra West'),
  );
  const [mapLayout, setMapLayout] = useState<{ width: number; height: number }>({ width: 360, height: 260 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastPublishedId, setLastPublishedId] = useState<string | null>(null);

  // Allergen & Dietary Tagging State
  const [description, setDescription] = useState('');
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [mayContain, setMayContain] = useState<string[]>([]);
  const [allergenInfoConfirmed, setAllergenInfoConfirmed] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<{
    dietary: Array<{ tag: string; confidence: 'high' | 'medium' | 'low'; reason: string }>;
    allergens: Array<{ tag: string; confidence: 'high' | 'medium' | 'low'; reason: string }>;
    mayContain: Array<{ tag: string; confidence: 'high' | 'medium' | 'low'; reason: string }>;
  } | null>(null);

  // Local contradiction checker for real-time vendor feedback
  const contradictionWarning = useMemo(() => {
    const full = `${name} ${description}`.toLowerCase();

    if (dietTags.includes('vegan')) {
      if (allergens.includes('milk') || allergens.includes('egg') || allergens.includes('fish') || allergens.includes('shellfish')) {
        return 'Contradiction: Item cannot be marked Vegan while containing milk, egg, or seafood allergens.';
      }
      if (/\b(milk|butter|ghee|cheese|paneer|curd|dahi|cream|malai|mawa|khoya|egg|eggs|fish|chicken|mutton|prawns)\b/i.test(full)) {
        return 'Contradiction: Item cannot be marked Vegan because dairy, egg, or animal products were mentioned in title/description.';
      }
    }

    if (dietTags.includes('vegetarian')) {
      if (allergens.includes('fish') || allergens.includes('shellfish')) {
        return 'Contradiction: Item cannot be marked Vegetarian while containing seafood allergens.';
      }
      if (/\b(chicken|mutton|pork|fish|prawn|prawns|crab|lobster|shrimp|meat|beef)\b/i.test(full)) {
        return 'Contradiction: Item cannot be marked Vegetarian because meat or seafood was mentioned.';
      }
    }

    if (dietTags.includes('egg_free')) {
      if (allergens.includes('egg')) {
        return 'Contradiction: Item cannot be marked Egg-Free while selecting Egg under Contains Allergens.';
      }
      if (/\b(egg|eggs|anda|baida|omelette)\b/i.test(full)) {
        return 'Contradiction: Item cannot be marked Egg-Free because eggs are mentioned.';
      }
    }

    if (dietTags.includes('jain')) {
      if (/\b(onion|garlic|potato|potatoes|aloo|carrot|carrots|radish|mooli|beetroot|non[\s\-]?veg|chicken|mutton|egg)\b/i.test(full)) {
        return 'Contradiction: Item cannot be marked Jain because root vegetables (onion, garlic, potato) or non-veg are mentioned.';
      }
    }

    return null;
  }, [name, description, dietTags, allergens]);

  // AI Tag suggestion handler (5s timeout, rate-limited backend with fallback)
  const runAutoTagging = async (overrideName?: string, overrideDesc?: string) => {
    const titleToUse = overrideName ?? name;
    const descToUse = overrideDesc ?? description;
    if (!titleToUse.trim()) {
      Alert.alert('Item Name Required', 'Please enter a food title before generating suggestions.');
      return;
    }
    setIsTagging(true);
    setFormError(null);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${apiUrl}/api/listings/suggest-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-marketplace-user-id': currentUser?.id || 'demo-vendor-1',
        },
        body: JSON.stringify({
          title: titleToUse.trim(),
          description: descToUse.trim() || undefined,
          imageUrl: imageUri || undefined,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setTagSuggestions(data);
        // Pre-fill suggestions, but vendor must explicitly confirm!
        setDietTags(Array.from(new Set(data.dietary.map((d: any) => d.tag))));
        setAllergens(Array.from(new Set(data.allergens.map((a: any) => a.tag))));
        setMayContain(Array.from(new Set(data.mayContain.map((m: any) => m.tag))));
        setAllergenInfoConfirmed(false);
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
      } else {
        // Fallback local heuristic tagging if API unavailable
        fallbackLocalTagging(titleToUse, descToUse);
      }
    } catch {
      // Offline / network timeout fallback
      fallbackLocalTagging(titleToUse, descToUse);
    } finally {
      setIsTagging(false);
    }
  };

  const fallbackLocalTagging = (t: string, d: string) => {
    const text = `${t} ${d}`.toLowerCase();
    const suggestedDiet: string[] = [];
    const suggestedAllergens: string[] = [];
    const suggestedMayContain: string[] = [];
    const reasons: Array<{ tag: string; confidence: 'high' | 'medium' | 'low'; reason: string }> = [];

    if (/\b(paneer|butter|ghee|cheese|cream|milk|dahi|curd|croissant|brioche)\b/i.test(text)) {
      suggestedAllergens.push('milk');
      reasons.push({ tag: 'milk', confidence: 'high', reason: 'Contains dairy ingredient' });
    }
    if (/\b(bread|croissant|flour|maida|roti|pav|bun|pastry|cake|cookie)\b/i.test(text)) {
      suggestedAllergens.push('gluten');
      reasons.push({ tag: 'gluten', confidence: 'high', reason: 'Contains wheat/gluten' });
    }
    if (/\b(walnut|almond|cashew|kaju|badam|pista|hazelnut|pecan)\b/i.test(text)) {
      suggestedAllergens.push('tree_nuts');
      reasons.push({ tag: 'tree_nuts', confidence: 'high', reason: 'Contains tree nuts' });
    }
    if (/\b(peanut|peanuts|shengdana|singdana)\b/i.test(text)) {
      suggestedAllergens.push('peanuts');
      reasons.push({ tag: 'peanuts', confidence: 'high', reason: 'Contains peanuts' });
    }
    if (/\b(egg|eggs|anda|baida|omelette)\b/i.test(text)) {
      suggestedAllergens.push('egg');
      reasons.push({ tag: 'egg', confidence: 'high', reason: 'Contains eggs' });
    } else {
      suggestedDiet.push('egg_free');
    }
    if (/\b(fish|prawn|prawns|crab|seafood|surmai|pomfret|bombil)\b/i.test(text)) {
      suggestedAllergens.push('fish');
      reasons.push({ tag: 'fish', confidence: 'high', reason: 'Contains fish/seafood' });
    } else {
      suggestedDiet.push('vegetarian');
    }

    setDietTags(suggestedDiet);
    setAllergens(suggestedAllergens);
    setMayContain(suggestedMayContain);
    setAllergenInfoConfirmed(false);
    setTagSuggestions({
      dietary: suggestedDiet.map((tag) => ({ tag, confidence: 'high', reason: 'Detected from keywords' })),
      allergens: reasons,
      mayContain: [],
    });
    Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setImageUri(res.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Upload Error', 'Could not open photo library. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera Access', 'Please allow camera access to take a picture of your surplus food.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setImageUri(res.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not start camera. Please try again or choose from library.');
    }
  };

  // Dynamic map bounds calculated from center and zoom level
  const mapBounds = useMemo(() => {
    const latSpan = 0.17 / pickerZoom;
    const lngSpan = 0.12 / pickerZoom;
    return {
      minLat: pickerCenter.latitude - latSpan / 2,
      maxLat: pickerCenter.latitude + latSpan / 2,
      minLng: pickerCenter.longitude - lngSpan / 2,
      maxLng: pickerCenter.longitude + lngSpan / 2,
    };
  }, [pickerCenter, pickerZoom]);

  const fillDemoOffer = () => {
    setName('Evening Brioche & Croissant Bag');
    setVendor('Bandra Artisan Bakers');
    setDescription('Artisanal French butter brioche and sourdough croissants baked fresh daily with whole milk butter and wheat flour.');
    setCategory('Bakery');
    setPrice('120');
    setOriginalPrice('350');
    setQuantity('4');
    setPickupWindow('Today, 6:30–8:00 PM');
    setArea('Juhu');
    setImageUri(PRESET_FOOD_PHOTOS[0].uri);
    setDietTags(['vegetarian']);
    setAllergens(['gluten', 'milk']);
    setMayContain(['tree_nuts', 'egg']);
    setAllergenInfoConfirmed(true);
    setTagSuggestions({
      dietary: [{ tag: 'vegetarian', confidence: 'high', reason: 'No meat or seafood used in bakery' }],
      allergens: [
        { tag: 'gluten', confidence: 'high', reason: 'Prepared with wheat flour' },
        { tag: 'milk', confidence: 'high', reason: 'Rich dairy butter in brioche and croissant' },
      ],
      mayContain: [{ tag: 'egg', confidence: 'medium', reason: 'Egg wash used on pastries in bakehouse' }],
    });
    const coords = getCoordinatesForArea('Juhu');
    setCoordinates(coords);
    setPickerCoords(coords);
    setPickerAreaName('Juhu');
    setPickerCenter(coords);
    setFormError(null);
    Haptics.selectionAsync();
  };

  const myListings = listings.filter((item) => item.isMine);

  // Filtered neighborhood suggestions for search
  const filteredSuggestions = useMemo(() => {
    const q = (pickerSearch || area || '').trim().toLowerCase();
    if (!q) return POPULAR_MUMBAI_AREAS.slice(0, 8);
    return POPULAR_MUMBAI_AREAS.filter((a) => a.toLowerCase().includes(q));
  }, [pickerSearch, area]);

  const modalSuggestions = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return [];
    return POPULAR_MUMBAI_AREAS.filter((a) => a.toLowerCase().includes(q));
  }, [pickerSearch]);

  const selectAddress = (selectedArea: string) => {
    setArea(selectedArea);
    const coords = getCoordinatesForArea(selectedArea);
    setCoordinates(coords);
    setPickerCoords(coords);
    setPickerAreaName(selectedArea);
    setPickerCenter(coords);
    setShowSuggestions(false);
    Haptics.selectionAsync();
  };

  const selectAddressInModal = (selectedArea: string) => {
    setPickerAreaName(selectedArea);
    const c = getCoordinatesForArea(selectedArea);
    setPickerCoords(c);
    setPickerCenter(c);
    setPickerZoom((z) => Math.max(z, 1.2));
    setPickerSearch('');
    Haptics.selectionAsync();
  };

  const openMapPicker = () => {
    setPickerCoords(coordinates);
    setPickerAreaName(area);
    setPickerCenter(coordinates);
    setPickerZoom(1.0);
    setPickerSearch('');
    setShowMapPicker(true);
    Haptics.selectionAsync();
  };

  const zoomIn = () => {
    setPickerZoom((z) => Math.min(2.5, Number((z + 0.35).toFixed(2))));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const zoomOut = () => {
    setPickerZoom((z) => Math.max(0.45, Number((z - 0.35).toFixed(2))));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const zoomToAllMumbai = () => {
    setPickerZoom(0.5);
    setPickerCenter({ latitude: 19.08, longitude: 72.88 });
    Haptics.selectionAsync();
  };

  const centerOnPin = () => {
    setPickerCenter(pickerCoords);
    setPickerZoom((z) => Math.max(z, 1.2));
    Haptics.selectionAsync();
  };

  const selectRegionPreset = (region: (typeof REGION_PRESETS)[number]) => {
    setPickerCenter({ latitude: region.lat, longitude: region.lng });
    setPickerZoom(region.zoom);
    if (region.name !== 'Mumbai Metro') {
      const c = { latitude: region.lat, longitude: region.lng };
      setPickerCoords(c);
      setPickerAreaName(region.name);
    }
    Haptics.selectionAsync();
  };

  const handleMapTap = (locationX: number, locationY: number, mapWidth = 360, mapHeight = 260) => {
    const { minLat, maxLat, minLng, maxLng } = mapBounds;
    const normX = Math.max(0, Math.min(1, locationX / mapWidth));
    const normY = Math.max(0, Math.min(1, locationY / mapHeight));

    const newLng = minLng + normX * (maxLng - minLng);
    const newLat = maxLat - normY * (maxLat - minLat);

    const newCoords = {
      latitude: Number(newLat.toFixed(5)),
      longitude: Number(newLng.toFixed(5)),
    };

    // Find closest neighborhood to tap
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

    setPickerCoords(newCoords);
    setPickerAreaName(closestName);
    if (pickerZoom > 1.4) {
      setPickerCenter(newCoords);
    }
    Haptics.selectionAsync();
  };

  const confirmMapLocation = () => {
    setArea(pickerAreaName);
    setCoordinates(pickerCoords);
    setShowMapPicker(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const publish = () => {
    setFormError(null);
    const amount = Number(price);
    const regular = Number(originalPrice);
    const portions = Number(quantity);
    if (!name.trim() || !vendor.trim()) {
      const msg = 'Please enter both the food item name and your shop name.';
      setFormError(msg);
      Alert.alert('A little more detail', msg);
      return;
    }
    if (!area.trim()) {
      const msg = 'Please choose or search a pickup neighborhood.';
      setFormError(msg);
      Alert.alert('Add a pickup neighborhood', msg);
      return;
    }
    if (
      !Number.isFinite(amount) ||
      !Number.isFinite(regular) ||
      amount <= 0 ||
      regular <= amount
    ) {
      const msg = 'Enter a valid discounted price lower than the usual price.';
      setFormError(msg);
      Alert.alert('Check your prices', msg);
      return;
    }
    if (!Number.isInteger(portions) || portions < 1) {
      const msg = 'Enter at least one available portion.';
      setFormError(msg);
      Alert.alert('Add available portions', msg);
      return;
    }

    // MANDATORY SAFETY CHECK: Allergen info confirmation required
    if (!allergenInfoConfirmed) {
      const msg = 'Please review and check the confirmation box verifying that the dietary and allergen information is accurate before posting.';
      setFormError(msg);
      Alert.alert('Confirm Allergen Safety', msg);
      return;
    }

    // Contradiction prevention
    if (contradictionWarning) {
      setFormError(contradictionWarning);
      Alert.alert('Contradictory Tags', contradictionWarning);
      return;
    }

    const photo: ListingPhoto = category === 'Bakery' ? 'bakery' : 'lunch';
    const newId = addListing({
      name: name.trim(),
      vendor: vendor.trim(),
      category,
      price: amount,
      originalPrice: regular,
      quantity: portions,
      pickupWindow: pickupWindow.trim() || 'Today, 5:00–6:00 PM',
      area: area.trim(),
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      distance: 'Nearby',
      photo,
      imageUri: imageUri || undefined,
      description: description.trim() || `${name.trim()} from ${vendor.trim()}, available for a neighborhood pickup.`,
      dietaryTags: dietTags,
      dietTags,
      allergens,
      mayContain,
      allergenInfoConfirmed: true,
      allergenConfirmedAt: new Date().toISOString(),
      allergenConfirmedBy: currentUser?.id || 'vendor',
      aiSuggestion: tagSuggestions,
    });
    setLastPublishedId(newId);
    setName('');
    setDescription('');
    setVendor('');
    setPrice('');
    setOriginalPrice('');
    setQuantity('');
    setImageUri(null);
    setDietTags([]);
    setAllergens([]);
    setMayContain([]);
    setAllergenInfoConfirmed(false);
    setTagSuggestions(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Your offer is live!',
      'Your surplus food and verified allergen details are now published.',
      [
        {
          text: 'View on Map',
          onPress: () => router.push({ pathname: '/map', params: { spotlight: newId } }),
        },
        { text: 'Done', style: 'cancel' },
      ],
    );
  };

  // Convert coordinates to percentage for map picker display relative to dynamic mapBounds
  const pinLeftPercent = useMemo(() => {
    const { minLng, maxLng } = mapBounds;
    const norm = (pickerCoords.longitude - minLng) / (maxLng - minLng);
    return `${Math.max(4, Math.min(96, norm * 100)).toFixed(1)}%` as DimensionValue;
  }, [pickerCoords.longitude, mapBounds]);

  const pinTopPercent = useMemo(() => {
    const { minLat, maxLat } = mapBounds;
    const norm = (maxLat - pickerCoords.latitude) / (maxLat - minLat);
    return `${Math.max(6, Math.min(94, norm * 100)).toFixed(1)}%` as DimensionValue;
  }, [pickerCoords.latitude, mapBounds]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 14,
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'web' ? 106 : Math.max(insets.bottom, 12) + 100,
        }}
        bottomOffset={70}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.secondaryForeground }]}>FOR LOCAL FOOD SHOPS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Save your surplus</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Turn today’s extras into someone’s favorite find.
        </Text>

        {mode !== 'vendor' ? (
          <Pressable
            onPress={() => setMode('vendor')}
            style={[styles.modeBanner, { backgroundColor: colors.foreground }]}
            accessibilityRole="button"
            testID="switch-to-vendor"
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeBannerTitle, { color: colors.background }]}>Switch to vendor view</Text>
              <Text style={[styles.modeBannerCopy, { color: '#d9e5d7' }]}>
                You can shop again any time.
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.background} />
          </Pressable>
        ) : null}

        {/* Vendor Profile Status Card */}
        {currentUser?.role === 'vendor' ? (
          <View style={[styles.vendorAccountCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.vendorAvatarCircle, { backgroundColor: colors.card }]}>
                <Feather name="coffee" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.vendorAccountName, { color: colors.foreground }]} numberOfLines={1}>
                    {currentUser.restaurantName || currentUser.name}
                  </Text>
                  <View style={[styles.verifiedPill, { backgroundColor: '#DCFCE7' }]}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#15803D' }}>VENDOR</Text>
                  </View>
                </View>
                <Text style={[styles.vendorAccountMeta, { color: colors.mutedForeground }]}>
                  {currentUser.area || 'Mumbai'} · Surplus dishes add to this restaurant
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/login')}
              style={[styles.switchAccountBtn, { borderColor: colors.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.switchAccountBtnText, { color: colors.primary }]}>Switch</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/login')}
            style={[styles.vendorPromptBanner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}
            accessibilityRole="button"
          >
            <Feather name="info" size={16} color="#D97706" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                Selling for a restaurant or bakery?
              </Text>
              <Text style={{ fontSize: 11, color: '#B45309', marginTop: 2, lineHeight: 16 }}>
                Sign in as a Vendor so all your dishes are grouped under your restaurant menu.
              </Text>
            </View>
            <View style={{ backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 11 }}>Sign In</Text>
            </View>
          </Pressable>
        )}

        {lastPublishedId ? (
          <View style={styles.successBanner}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Feather name="check-circle" size={18} color="#2b8253" />
              <View style={{ flex: 1 }}>
                <Text style={styles.successBannerTitle}>Listing is live on the map!</Text>
                <Text style={styles.successBannerText}>
                  Your offer was pinned for shoppers to discover.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/map', params: { spotlight: lastPublishedId } })}
              style={styles.successBannerBtn}
              accessibilityRole="button"
              testID="view-on-map-success"
            >
              <Text style={styles.successBannerBtnText}>View on Map</Text>
              <Feather name="arrow-right" size={13} color="#ffffff" />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formHeading}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.formIcon, { backgroundColor: colors.accent }]}>
                <Feather name="plus" size={17} color={colors.secondaryForeground} />
              </View>
              <View>
                <Text style={[styles.formTitle, { color: colors.foreground }]}>Post a pickup offer</Text>
                <Text style={[styles.formNote, { color: colors.mutedForeground }]}>Takes about a minute</Text>
              </View>
            </View>
            <Pressable
              onPress={fillDemoOffer}
              style={[styles.demoFillBtn, { backgroundColor: colors.secondary }]}
              accessibilityRole="button"
              accessibilityLabel="Quickly fill sample details"
              testID="fill-demo-offer"
            >
              <Feather name="zap" size={12} color={colors.secondaryForeground} />
              <Text style={[styles.demoFillBtnText, { color: colors.secondaryForeground }]}>Demo Fill</Text>
            </Pressable>
          </View>

          {formError ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color="#d9534f" />
              <Text style={styles.errorBannerText}>{formError}</Text>
            </View>
          ) : null}

          <Field label="What’s available?" value={name} onChangeText={(t) => { setName(t); setFormError(null); }} placeholder="e.g. End-of-day pastry bag" testID="listing-name" />
          <Field label="Shop name" value={vendor} onChangeText={(t) => { setVendor(t); setFormError(null); }} placeholder="Your bakery or cafe" testID="vendor-name" />

          {/* Description & Ingredients Field */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Ingredients & Details</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, minHeight: 64, paddingVertical: 8, alignItems: 'flex-start' }]}>
              <TextInput
                value={description}
                onChangeText={(t) => { setDescription(t); setFormError(null); }}
                placeholder="e.g. Sourdough croissants made with whole wheat flour and churned milk butter..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={[styles.input, { color: colors.foreground, textAlignVertical: 'top' }]}
                testID="listing-description"
              />
            </View>
          </View>

          {/* Food Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.photoHeaderRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>Food photo</Text>
              <Text style={[styles.photoOptionalText, { color: colors.mutedForeground }]}>
                Optional · boosts reservations
              </Text>
            </View>

            {imageUri ? (
              <View style={[styles.photoPreviewCard, { borderColor: colors.border }]}>
                <Image source={{ uri: imageUri }} style={styles.photoPreviewImage} />
                <View style={styles.photoPreviewOverlay}>
                  <Pressable
                    onPress={pickImage}
                    style={[styles.photoActionBtn, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Change food photo"
                  >
                    <Feather name="refresh-cw" size={13} color="#ffffff" />
                    <Text style={styles.photoActionBtnText}>Change</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setImageUri(null)}
                    style={[styles.photoActionBtn, { backgroundColor: 'rgba(180, 40, 40, 0.85)' }]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Feather name="trash-2" size={13} color="#ffffff" />
                    <Text style={styles.photoActionBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.photoUploadContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.photoUploadButtons}>
                  <Pressable
                    onPress={pickImage}
                    style={[styles.photoUploadBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo from library"
                    testID="pick-photo-button"
                  >
                    <Feather name="image" size={16} color={colors.foreground} />
                    <Text style={[styles.photoUploadBtnText, { color: colors.foreground }]}>Choose photo</Text>
                  </Pressable>
                  <Pressable
                    onPress={takePhoto}
                    style={[styles.photoUploadBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo with camera"
                    testID="take-photo-button"
                  >
                    <Feather name="camera" size={16} color={colors.foreground} />
                    <Text style={[styles.photoUploadBtnText, { color: colors.foreground }]}>Take photo</Text>
                  </Pressable>
                </View>

                <View style={styles.presetPhotosContainer}>
                  <Text style={[styles.presetPhotosLabel, { color: colors.mutedForeground }]}>
                    Or pick a fast appetizing preset:
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.presetPhotosRow}
                  >
                    {PRESET_FOOD_PHOTOS.map((preset) => (
                      <Pressable
                        key={preset.label}
                        onPress={() => {
                          setImageUri(preset.uri);
                          Haptics.selectionAsync();
                        }}
                        style={[
                          styles.presetPhotoChip,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Use preset ${preset.label}`}
                      >
                        <Image source={{ uri: preset.uri }} style={styles.presetPhotoThumb} />
                        <Text style={[styles.presetPhotoText, { color: colors.foreground }]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}
          </View>

          {/* Pickup Address & Neighborhood Section */}
          <View style={styles.addressSection}>
            <View style={styles.addressHeaderRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>Pickup neighborhood & location</Text>
              <Pressable
                onPress={openMapPicker}
                style={[styles.mapPickerTrigger, { backgroundColor: colors.secondary }]}
                accessibilityRole="button"
                accessibilityLabel="Choose shop location on interactive map"
                testID="open-map-picker"
              >
                <Feather name="map" size={12} color={colors.secondaryForeground} />
                <Text style={[styles.mapPickerTriggerText, { color: colors.secondaryForeground }]}>
                  Pin on Map
                </Text>
              </Pressable>
            </View>

            {/* Address Input */}
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                value={area}
                onChangeText={(text) => {
                  setArea(text);
                  setShowSuggestions(true);
                  if (text.trim().length >= 3) {
                    const c = getCoordinatesForArea(text);
                    setCoordinates(c);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search neighborhood (e.g. Bandra West, Khar)..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground }]}
                testID="pickup-area"
              />
              {area.length > 0 && (
                <Pressable
                  onPress={() => {
                    setArea('');
                    setShowSuggestions(true);
                  }}
                  hitSlop={8}
                >
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Live Autocomplete Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <View style={[styles.suggestionsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {filteredSuggestions.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => selectAddress(item)}
                    style={styles.suggestionRow}
                  >
                    <Feather name="map-pin" size={12} color={colors.primary} />
                    <Text style={[styles.suggestionText, { color: colors.foreground }]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Quick Neighborhood Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaChipsRow}>
              {POPULAR_MUMBAI_AREAS.slice(0, 8).map((popular) => {
                const isSelected = area.toLowerCase() === popular.toLowerCase();
                return (
                  <Pressable
                    key={popular}
                    onPress={() => selectAddress(popular)}
                    style={[
                      styles.areaChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.secondary,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.areaChipText,
                        { color: isSelected ? colors.primaryForeground : colors.secondaryForeground },
                      ]}
                    >
                      {popular}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Location Confirmed Badge */}
            <View style={[styles.locationBadge, { backgroundColor: '#eaf3ec', borderColor: '#bedbc4' }]}>
              <View style={styles.locationBadgeLeft}>
                <Feather name="check-circle" size={14} color="#2b8253" />
                <View>
                  <Text style={styles.locationBadgeTitle}>
                    Pinned at {area || 'Bandra West'}
                  </Text>
                  <Text style={styles.locationBadgeCoords}>
                    {coordinates.latitude.toFixed(4)}° N, {coordinates.longitude.toFixed(4)}° E
                  </Text>
                </View>
              </View>
              <Pressable onPress={openMapPicker} style={styles.changeLocBtn}>
                <Text style={styles.changeLocBtnText}>Change</Text>
              </Pressable>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.foreground, marginTop: 12 }]}>Food type</Text>
          <View style={styles.categories}>
            {(['Bakery', 'Cafe', 'Meals'] as FoodCategory[]).map((item) => {
              const selected = item === category;
              return (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryButton,
                    { borderColor: selected ? colors.foreground : colors.border, backgroundColor: selected ? colors.foreground : colors.background },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  testID={`vendor-category-${item.toLowerCase()}`}
                >
                  <Text style={[styles.categoryText, { color: selected ? colors.background : colors.secondaryForeground }]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Field label="Your price" value={price} onChangeText={setPrice} placeholder="149" keyboardType="decimal-pad" prefix="₹" testID="discount-price" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Usual price" value={originalPrice} onChangeText={setOriginalPrice} placeholder="399" keyboardType="decimal-pad" prefix="₹" testID="original-price" />
            </View>
          </View>
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Field label="Available portions" value={quantity} onChangeText={setQuantity} placeholder="4" keyboardType="number-pad" testID="listing-quantity" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Pickup window" value={pickupWindow} onChangeText={setPickupWindow} placeholder="Today, 5–6 PM" testID="pickup-window" />
            </View>
          </View>

          {/* Allergen & Dietary Verification Section */}
          <View style={[styles.allergenSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.allergenHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.allergenSectionTitle, { color: colors.foreground }]}>
                  Allergen & Dietary Safety
                </Text>
                <Text style={[styles.allergenSectionSubtitle, { color: colors.mutedForeground }]}>
                  Required review · AI suggests, vendor confirms
                </Text>
              </View>
              <Pressable
                onPress={() => runAutoTagging()}
                disabled={isTagging}
                style={[styles.aiDetectBtn, { backgroundColor: '#173b2d' }]}
                accessibilityRole="button"
                testID="ai-auto-tag-btn"
              >
                {isTagging ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                ) : (
                  <Feather name="zap" size={13} color="#ffffff" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.aiDetectBtnText}>
                  {isTagging ? 'Analyzing...' : 'Auto-Detect (AI)'}
                </Text>
              </Pressable>
            </View>

            {tagSuggestions && (
              <View style={[styles.aiNoticePill, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <Feather name="info" size={13} color="#166534" />
                <Text style={[styles.aiNoticeText, { color: '#166534' }]}>
                  Suggested by AI based on title and ingredients. Please check and confirm.
                </Text>
              </View>
            )}

            {/* Dietary Tags */}
            <View style={styles.tagGroup}>
              <Text style={[styles.tagGroupLabel, { color: colors.foreground }]}>
                Dietary Category
              </Text>
              <View style={styles.tagChipsWrap}>
                {DIETARY_CHOICES.map((choice) => {
                  const selected = dietTags.includes(choice.id);
                  return (
                    <Pressable
                      key={choice.id}
                      onPress={() => {
                        setDietTags((prev) =>
                          prev.includes(choice.id) ? prev.filter((d) => d !== choice.id) : [...prev, choice.id]
                        );
                        setAllergenInfoConfirmed(false);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: selected ? '#15803d' : colors.card,
                          borderColor: selected ? '#15803d' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.tagChipText, { color: selected ? '#ffffff' : colors.foreground }]}>
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Contains Allergens */}
            <View style={styles.tagGroup}>
              <Text style={[styles.tagGroupLabel, { color: colors.foreground }]}>
                Contains Allergens
              </Text>
              <View style={styles.tagChipsWrap}>
                {ALLERGEN_CHOICES.map((choice) => {
                  const selected = allergens.includes(choice.id);
                  return (
                    <Pressable
                      key={choice.id}
                      onPress={() => {
                        setAllergens((prev) => {
                          const next = prev.includes(choice.id)
                            ? prev.filter((a) => a !== choice.id)
                            : [...prev, choice.id];
                          return next;
                        });
                        setMayContain((prev) => prev.filter((m) => m !== choice.id));
                        setAllergenInfoConfirmed(false);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: selected ? '#dc2626' : colors.card,
                          borderColor: selected ? '#dc2626' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.tagChipText, { color: selected ? '#ffffff' : colors.foreground }]}>
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* May Contain Traces */}
            <View style={styles.tagGroup}>
              <Text style={[styles.tagGroupLabel, { color: colors.foreground }]}>
                May Contain Traces Of (Facility / Cross-Contact)
              </Text>
              <View style={styles.tagChipsWrap}>
                {ALLERGEN_CHOICES.map((choice) => {
                  const selected = mayContain.includes(choice.id);
                  return (
                    <Pressable
                      key={choice.id}
                      onPress={() => {
                        setMayContain((prev) => {
                          const next = prev.includes(choice.id)
                            ? prev.filter((m) => m !== choice.id)
                            : [...prev, choice.id];
                          return next;
                        });
                        setAllergens((prev) => prev.filter((a) => a !== choice.id));
                        setAllergenInfoConfirmed(false);
                        Haptics.selectionAsync();
                      }}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: selected ? '#d97706' : colors.card,
                          borderColor: selected ? '#d97706' : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.tagChipText, { color: selected ? '#ffffff' : colors.foreground }]}>
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* AI Reasoning Hints if available */}
            {tagSuggestions && (tagSuggestions.allergens.length > 0 || tagSuggestions.dietary.length > 0) && (
              <View style={[styles.aiReasoningBox, { borderColor: colors.border }]}>
                <Text style={[styles.aiReasoningTitle, { color: colors.mutedForeground }]}>
                  Why AI suggested these tags:
                </Text>
                {tagSuggestions.allergens.map((item) => (
                  <Text key={`reason-${item.tag}`} style={[styles.aiReasonItem, { color: colors.foreground }]}>
                    • <Text style={{ fontWeight: '700' }}>{item.tag}</Text>: {item.reason} ({item.confidence})
                  </Text>
                ))}
                {tagSuggestions.dietary.map((item) => (
                  <Text key={`reason-diet-${item.tag}`} style={[styles.aiReasonItem, { color: colors.foreground }]}>
                    • <Text style={{ fontWeight: '700' }}>{item.tag}</Text>: {item.reason}
                  </Text>
                ))}
              </View>
            )}

            {/* Real-time Contradiction Warning */}
            {contradictionWarning && (
              <View style={styles.contradictionAlert}>
                <Feather name="alert-triangle" size={16} color="#b91c1c" />
                <Text style={styles.contradictionAlertText}>{contradictionWarning}</Text>
              </View>
            )}

            {/* MANDATORY Safety Confirmation Checkbox */}
            <Pressable
              onPress={() => {
                setAllergenInfoConfirmed(!allergenInfoConfirmed);
                Haptics.selectionAsync();
              }}
              style={[
                styles.confirmCheckboxCard,
                {
                  borderColor: allergenInfoConfirmed ? '#2b8253' : '#d97706',
                  backgroundColor: allergenInfoConfirmed ? '#f0fdf4' : '#fffbeb',
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allergenInfoConfirmed }}
              testID="confirm-allergen-checkbox"
            >
              <View
                style={[
                  styles.checkboxSquare,
                  {
                    backgroundColor: allergenInfoConfirmed ? '#2b8253' : '#ffffff',
                    borderColor: allergenInfoConfirmed ? '#2b8253' : '#d97706',
                  },
                ]}
              >
                {allergenInfoConfirmed && <Feather name="check" size={14} color="#ffffff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.confirmCheckboxTitle,
                    { color: allergenInfoConfirmed ? '#166534' : '#92400e' },
                  ]}
                >
                  I confirm this allergen and dietary information is accurate.
                </Text>
                <Text
                  style={[
                    styles.confirmCheckboxSubtitle,
                    { color: allergenInfoConfirmed ? '#15803d' : '#b45309' },
                  ]}
                >
                  Mandatory: Incorrect allergen info can cause severe harm.
                </Text>
              </View>
            </Pressable>
          </View>

          {!allergenInfoConfirmed && (
            <View style={styles.lockNotice}>
              <Feather name="lock" size={12} color="#b45309" />
              <Text style={styles.lockNoticeText}>
                Check the confirmation box above to enable posting
              </Text>
            </View>
          )}

          <Pressable
            onPress={publish}
            disabled={!allergenInfoConfirmed}
            style={({ pressed }) => [
              styles.publishButton,
              { backgroundColor: allergenInfoConfirmed ? colors.primary : '#9ca3af' },
              pressed && allergenInfoConfirmed && styles.pressed,
            ]}
            accessibilityRole="button"
            testID="publish-listing"
          >
            <Feather
              name={allergenInfoConfirmed ? "send" : "lock"}
              size={15}
              color={colors.primaryForeground}
            />
            <Text style={[styles.publishText, { color: colors.primaryForeground }]}>
              {allergenInfoConfirmed ? 'Post this offer' : 'Confirm allergen info to post'}
            </Text>
          </Pressable>
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Neighbors reserve online and pay when they pick up.
          </Text>
        </View>

        {/* Live Offers Header */}
        <View style={styles.liveHeader}>
          <Text style={[styles.liveTitle, { color: colors.foreground }]}>Your live offers</Text>
          <Text style={[styles.liveCount, { color: colors.mutedForeground }]}>{myListings.length} active</Text>
        </View>
        {myListings.length ? (
          myListings.map((item) => (
            <View key={item.id} style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.liveThumb} />
              ) : (
                <View style={[styles.liveDot, { backgroundColor: item.quantity > 0 ? '#57946a' : colors.mutedForeground }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.liveName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.liveMeta, { color: colors.mutedForeground }]}>
                  {item.quantity > 0 ? `${item.quantity} portions left` : 'All picked up'} · ₹${item.price.toLocaleString('en-IN')} · {item.area}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push({ pathname: '/map', params: { spotlight: item.id } })}
                style={[styles.viewOnMapButton, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="View this offer on map"
                testID={`view-on-map-${item.id}`}
              >
                <Feather name="map-pin" size={13} color={colors.secondaryForeground} />
                <Text style={[styles.viewOnMapText, { color: colors.secondaryForeground }]}>Map</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <View style={[styles.noOffers, { borderColor: colors.border }]}>
            <Text style={[styles.noOffersText, { color: colors.mutedForeground }]}>
              Your posted offers will show up here.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>

      {/* Interactive Map Location Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  Choose Shop Location
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  Tap anywhere on the map or search an address
                </Text>
              </View>
              <Pressable
                onPress={() => setShowMapPicker(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Modal Search Bar */}
            <View style={[styles.modalSearchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search neighborhood (e.g. Khar, Bandra, BKC)..."
                placeholderTextColor={colors.mutedForeground}
                style={[styles.modalSearchInput, { color: colors.foreground }]}
              />
              {pickerSearch.length > 0 && (
                <Pressable onPress={() => setPickerSearch('')}>
                  <Feather name="x-circle" size={15} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Search Suggestions when typing */}
            {modalSuggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalPills}>
                {modalSuggestions.slice(0, 8).map((popular) => (
                  <Pressable
                    key={popular}
                    onPress={() => selectAddressInModal(popular)}
                    style={[styles.modalPill, { backgroundColor: colors.accent, borderColor: colors.primary }]}
                  >
                    <Feather name="map-pin" size={11} color={colors.primary} />
                    <Text style={[styles.modalPillText, { color: colors.foreground, fontWeight: '700' }]}>
                      {popular}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Region Presets and Zoom Out Row */}
            <View style={{ marginBottom: 10 }}>
              <View style={styles.regionPresetsHeader}>
                <Text style={[styles.regionPresetsTitle, { color: colors.mutedForeground }]}>
                  MAP SCOPE & QUICK REGIONS
                </Text>
                <Pressable
                  onPress={zoomToAllMumbai}
                  style={[
                    styles.allMumbaiBtn,
                    pickerZoom <= 0.6 && { backgroundColor: '#2b8253', borderColor: '#2b8253' },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Zoom out to all Mumbai"
                >
                  <Feather name="maximize-2" size={11} color={pickerZoom <= 0.6 ? '#ffffff' : '#2b8253'} />
                  <Text
                    style={[
                      styles.allMumbaiBtnText,
                      { color: pickerZoom <= 0.6 ? '#ffffff' : '#2b8253' },
                    ]}
                  >
                    All Mumbai View
                  </Text>
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalPills}>
                {REGION_PRESETS.map((region) => {
                  const isCurrent =
                    (region.name === 'Mumbai Metro' && pickerZoom <= 0.6) ||
                    (pickerZoom > 0.6 &&
                      Math.abs(pickerCenter.latitude - region.lat) < 0.03 &&
                      Math.abs(pickerCenter.longitude - region.lng) < 0.03);
                  return (
                    <Pressable
                      key={region.label}
                      onPress={() => selectRegionPreset(region)}
                      style={[
                        styles.modalPill,
                        {
                          backgroundColor: isCurrent ? colors.primary : colors.secondary,
                          borderColor: isCurrent ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modalPillText,
                          { color: isCurrent ? colors.primaryForeground : colors.secondaryForeground },
                        ]}
                      >
                        {region.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Interactive Location Picker Map (react-native-maps on native / real tiles on web) */}
            <View style={styles.pickerMapContainer}>
              <LocationPickerMap
                coordinate={pickerCoords}
                areaName={pickerAreaName}
                center={pickerCenter}
                zoom={pickerZoom}
                onCoordinateChange={(newCoords: { latitude: number; longitude: number }, nearestName?: string) => {
                  setPickerCoords(newCoords);
                  if (nearestName) {
                    setPickerAreaName(nearestName);
                  }
                  if (pickerZoom > 1.4) {
                    setPickerCenter(newCoords);
                  }
                }}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onZoomToAllMumbai={zoomToAllMumbai}
                onCenterOnPin={centerOnPin}
              />
            </View>

            {/* Modal Bottom Actions */}
            <View style={styles.modalFooter}>
              <View style={styles.modalFooterInfo}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.modalFooterLabel, { color: colors.mutedForeground }]}>
                    Selected shop location
                  </Text>
                  <Pressable
                    onPress={centerOnPin}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Feather name="crosshair" size={11} color="#2b8253" />
                    <Text style={{ fontSize: 10, color: '#2b8253', fontWeight: '700' }}>Center pin</Text>
                  </Pressable>
                </View>
                <Text style={[styles.modalFooterValue, { color: colors.foreground }]}>
                  {pickerAreaName} ({pickerCoords.latitude.toFixed(4)}°, {pickerCoords.longitude.toFixed(4)}°)
                </Text>
              </View>

              <Pressable
                onPress={confirmMapLocation}
                style={[styles.modalConfirmBtn, { backgroundColor: '#2b8253' }]}
                accessibilityRole="button"
                testID="confirm-map-location"
              >
                <Feather name="check" size={16} color="#ffffff" />
                <Text style={styles.modalConfirmBtnText}>Confirm Location</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 29, letterSpacing: -0.6, fontWeight: '700', marginTop: 5 },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 15 },
  modeBanner: { padding: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  modeBannerTitle: { fontSize: 13, fontWeight: '700' },
  modeBannerCopy: { fontSize: 11, marginTop: 2 },

  successBanner: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#2b8253',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  successBannerTitle: { fontSize: 13, fontWeight: '700', color: '#173b2d' },
  successBannerText: { fontSize: 11, color: '#3a664e', marginTop: 2 },
  successBannerBtn: {
    backgroundColor: '#2b8253',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successBannerBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  demoFillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  demoFillBtnText: { fontSize: 11, fontWeight: '700' },

  errorBanner: {
    backgroundColor: '#fdf2f2',
    borderWidth: 1,
    borderColor: '#f5c6cb',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  errorBannerText: { color: '#721c24', fontSize: 11, fontWeight: '600', flex: 1 },

  formCard: { borderWidth: 1, borderRadius: 20, padding: 18, marginBottom: 20 },
  formHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  formIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 15, fontWeight: '700' },
  formNote: { fontSize: 10, marginTop: 3 },
  field: { flex: 1, marginBottom: 13 },
  label: { fontSize: 11, fontWeight: '700', marginBottom: 7 },
  inputWrap: { height: 45, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 12, paddingVertical: 8 },
  prefix: { marginRight: 4, fontSize: 12 },

  // Address Section
  addressSection: { marginBottom: 13 },
  addressHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  mapPickerTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  mapPickerTriggerText: { fontSize: 11, fontWeight: '700' },
  suggestionsBox: { borderWidth: 1, borderRadius: 12, marginTop: 4, overflow: 'hidden', maxHeight: 150 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  suggestionText: { fontSize: 12, fontWeight: '600' },
  areaChipsRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
  areaChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  areaChipText: { fontSize: 11, fontWeight: '600' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  locationBadgeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationBadgeTitle: { fontSize: 11, fontWeight: '700', color: '#173b2d' },
  locationBadgeCoords: { fontSize: 10, color: '#4a6b57', marginTop: 1 },
  changeLocBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  changeLocBtnText: { fontSize: 11, fontWeight: '700', color: '#2b8253' },

  categories: { flexDirection: 'row', gap: 7, marginBottom: 15 },
  categoryButton: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10 },
  publishButton: { minHeight: 47, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 13 },
  publishText: { fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  disclaimer: { fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 9 },
  liveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 10 },
  liveTitle: { fontSize: 17, fontWeight: '700' },
  liveCount: { fontSize: 10 },
  liveCard: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 5 },
  liveName: { fontSize: 12, fontWeight: '700' },
  liveMeta: { fontSize: 10, marginTop: 4 },
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  viewOnMapText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noOffers: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 15, alignItems: 'center' },
  noOffersText: { fontSize: 11 },

  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalSubtitle: { fontSize: 11, marginTop: 2 },
  modalCloseBtn: { padding: 4 },
  modalSearchBox: { flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, gap: 8, marginBottom: 10 },
  modalSearchInput: { flex: 1, fontSize: 12 },
  modalPills: { gap: 6, marginBottom: 10 },
  modalPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalPillText: { fontSize: 11, fontWeight: '600' },

  regionPresetsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  regionPresetsTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  allMumbaiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c4ddce',
    backgroundColor: '#f3f8f4',
  },
  allMumbaiBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },

  pickerMapContainer: { height: 270, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#d4decb', position: 'relative' },
  pickerMapTouchArea: { width: '100%', height: '100%' },
  pickerPin: { position: 'absolute', transform: [{ translateX: -18 }, { translateY: -40 }], alignItems: 'center', zIndex: 5 },
  pickerPinCallout: { backgroundColor: '#173b2d', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 4, alignItems: 'center' },
  pickerPinCalloutTitle: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  pickerPinCalloutCoords: { color: '#c4ddce', fontSize: 8, marginTop: 1 },
  pickerPinHalo: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(43, 130, 83, 0.35)', alignItems: 'center', justifyContent: 'center' },
  pickerPinDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#2b8253', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },

  floatingZoomControls: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
    overflow: 'hidden',
  },
  floatingZoomBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingZoomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#d4decb',
    width: '100%',
  },
  floatingZoomBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  floatingZoomBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#173b2d',
  },

  mapTapHint: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 8 },
  mapTapHintText: { fontSize: 9, fontWeight: '700', color: '#536d5b' },

  modalFooter: { marginTop: 14, gap: 10 },
  modalFooterInfo: { backgroundColor: '#f5f7f4', padding: 10, borderRadius: 12 },
  modalFooterLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  modalFooterValue: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  modalConfirmBtn: { height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modalConfirmBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },

  // Food Photo Section Styles
  photoSection: {
    marginBottom: 14,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  photoOptionalText: {
    fontSize: 11,
    fontWeight: '500',
  },
  photoUploadContainer: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 12,
  },
  photoUploadButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  photoUploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoUploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetPhotosContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  presetPhotosLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetPhotosRow: {
    gap: 8,
  },
  presetPhotoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetPhotoThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  presetPhotoText: {
    fontSize: 11,
    fontWeight: '600',
  },
  photoPreviewCard: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 160,
    position: 'relative',
    borderWidth: 1,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoPreviewOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  photoActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  liveThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 4,
  },
  vendorAccountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  vendorAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorAccountName: {
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vendorAccountMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  switchAccountBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchAccountBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vendorPromptBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  allergenSection: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  allergenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  allergenSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  allergenSectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  aiDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  aiDetectBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  aiNoticePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  aiNoticeText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  tagGroup: {
    marginBottom: 12,
  },
  tagGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  tagChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  aiReasoningBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  aiReasoningTitle: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  aiReasonItem: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  contradictionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    marginBottom: 12,
  },
  contradictionAlertText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  confirmCheckboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 4,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCheckboxTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  confirmCheckboxSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  lockNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
    marginTop: 6,
  },
  lockNoticeText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '600',
  },
});


