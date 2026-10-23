import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodListing, formatRupees } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';
import { useChatWithAssistant, type ActiveListingSummary } from '@workspace/api-client-react';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  listingIds?: string[];
}

interface AIChatSheetProps {
  visible: boolean;
  onClose: () => void;
  listings: FoodListing[];
  userArea?: string;
}

const SUGGESTION_CHIPS = [
  '🔥 Biggest discounts',
  '⚡ Ending soon',
  '🥐 Bakery under ₹100',
  '🥗 Veg & Jain options',
  '☕ Cafe snacks in Bandra',
];

const NON_VEG_WORDS = [
  'chicken',
  'mutton',
  'kheema',
  'keema',
  'meat',
  'fish',
  'prawn',
  'prawns',
  'seafood',
  'bacon',
  'pork',
  'lamb',
  'gosht',
  'egg',
];

function isListingNonVeg(l: FoodListing): boolean {
  const text = `${l.name} ${l.description || ''} ${l.vendor} ${l.category}`.toLowerCase();
  const hasNonVegWord = NON_VEG_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
  const hasVegTitle = /\b(veg|veggie|vegetables?|shakahari|jain|vegan)\b/i.test(l.name);
  const tags = (l.dietaryTags || l.dietTags || []).map((t) => t.toLowerCase());
  const isPureVegTagged =
    tags.includes('veg') ||
    tags.includes('vegetarian') ||
    tags.includes('vegan') ||
    tags.includes('jain');
  return hasNonVegWord && (!hasVegTitle || !isPureVegTagged);
}

// Levenshtein distance for fuzzy typo tolerance
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    let prev = i;
    for (let j = 1; j <= a.length; j++) {
      const val = b[i - 1] === a[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[a.length] = prev;
  }
  return row[a.length];
}

function hasFuzzyWord(text: string, targets: string[], maxDistance = 1): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const target of targets) {
      if (word === target) return true;
      if (Math.abs(word.length - target.length) <= maxDistance) {
        if (levenshteinDistance(word, target) <= maxDistance) return true;
      }
    }
  }
  return false;
}

const BAKERY_KEYWORDS = [
  'bakery', 'bread', 'croissant', 'pastry', 'cake', 'cruffin',
  'sourdough', 'brioche', 'focaccia', 'babka', 'tart', 'bun',
  'muffin', 'donut', 'cookie', 'dessert', 'sweet', 'meetha', 'mithai'
];

const CAFE_KEYWORDS = [
  'cafe', 'coffee', 'chai', 'tea', 'sandwich', 'snack', 'nashta',
  'burger', 'wrap', 'roll', 'samosa', 'puff', 'salad', 'juice', 'shake'
];

const MEALS_KEYWORDS = [
  'meal', 'lunch', 'dinner', 'thali', 'biryani', 'rice', 'roti',
  'curry', 'paneer', 'dal', 'tiffin', 'platter', 'combo', 'pizza', 'pasta', 'noodles'
];

const MUMBAI_AREAS = [
  'bandra', 'khar', 'colaba', 'lower parel', 'dadar', 'juhu',
  'andheri', 'powai', 'santacruz', 'bkc', 'churchgate', 'marine drive',
  'worli', 'kemps corner', 'fort', 'byculla', 'vile parle', 'matunga', 'sion', 'malad', 'borivali'
];

// Intelligent local fallback generator for offline resilience
function generateLocalSaveBotReply(
  prompt: string,
  listings: FoodListing[],
  userArea?: string,
): { reply: string; listingIds: string[] } {
  const query = prompt.toLowerCase().trim();

  // 1. GREETING & INTRO DETECTION
  const isGreeting = /^(hi|hello|hey|hola|namaste|yo|good (morning|afternoon|evening)|help|who are you|what can you do)[\s!.]*$/i.test(query);
  if (isGreeting) {
    const featured = listings.slice(0, 3);
    const names = featured.map((l) => `${l.name} (${formatRupees(l.price)})`).join(', ');
    return {
      reply: `Hi there! 👋 I'm SaveBot, your Mumbai food rescue assistant. Ask me to find deals near you, bakery snacks under ₹100, meals ending soon, or pure veg specials. Current rescue finds: ${names}. What are you craving?`,
      listingIds: featured.map((l) => l.id),
    };
  }

  // 2. DIETARY FILTERS
  const isNonVeg =
    /\b(non[- ]?veg(?:etarian)?|no[- ]veg|not[- ]veg|mansahari|chicken|mutton|meat|fish|prawns?|kheema|keema|seafood|pork|bacon|lamb|gosht)\b/i.test(
      query,
    ) || hasFuzzyWord(query, ['chicken', 'mutton', 'nonveg', 'seafood']);

  const isJain = /\b(jain|no onion|no garlic|swaminarayan)\b/i.test(query);
  const isVeg =
    !isNonVeg &&
    (/(?<!no\s+|non[- ]?|not\s+)\b(veg|veggie|vegetarians?|shakahari)\b/i.test(query) ||
      hasFuzzyWord(query, ['vegetarian', 'veggie']) ||
      isJain);
  const isVegan = !isNonVeg && query.includes('vegan');
  const isEggless = query.includes('eggless') || query.includes('no egg') || query.includes('egg-free');
  const isNutFree =
    query.includes('nut-free') ||
    query.includes('no nut') ||
    query.includes('nut free') ||
    query.includes('without nuts');

  // 3. CATEGORY FILTERS WITH FUZZY SUPPORT
  const isBakery = BAKERY_KEYWORDS.some((k) => query.includes(k)) || hasFuzzyWord(query, ['bakery', 'croissant', 'pastry', 'cake', 'bread', 'dessert']);
  const isCafe = CAFE_KEYWORDS.some((k) => query.includes(k)) || hasFuzzyWord(query, ['coffee', 'sandwich', 'burger', 'snacks', 'cafe']);
  const isMeals = MEALS_KEYWORDS.some((k) => query.includes(k)) || hasFuzzyWord(query, ['biryani', 'thali', 'dinner', 'lunch', 'meals', 'curry', 'pizza']);

  // 4. PRICE FILTER
  let maxPrice: number | null = null;
  const priceMatch =
    query.match(/(?:under|below|sub|less than|within|₹|rs\.?|inr)\s*(\d+)/i) ||
    query.match(/(\d+)\s*(?:rs|rupees|inr|or less)/i);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  // 5. AREA FILTER WITH FUZZY MATCH
  let matchedArea: string | undefined = undefined;
  for (const area of MUMBAI_AREAS) {
    if (query.includes(area) || hasFuzzyWord(query, [area])) {
      matchedArea = area;
      break;
    }
  }
  if (!matchedArea && query.includes('near me') && userArea) {
    matchedArea = userArea.toLowerCase();
  }

  const isEndingSoon = /\b(ending soon|ends soon|closing soon|closes soon|urgent|last chance|expiring|hurry|pickup soon)\b/i.test(query);
  const isBestDeals = /\b(best deals?|biggest discounts?|highest discounts?|huge discounts?|top savings?|cheapest|steal|super saver)\b/i.test(query);
  const isExpensive = /\b(expensive|costly|costliest|priciest|pricy|premium|luxury|gourmet|highest price|most expensive)\b/i.test(query);

  // VENDOR / RESTAURANT EXTRACTION (e.g. "bastian", "subko", "theobroma", "bombay canteen")
  let matchedVendor: string | null = null;
  for (const item of listings) {
    const vWords = (item.vendor || '').toLowerCase().split(/[^a-z0-9]+/);
    for (const vw of vWords) {
      if (vw.length >= 4 && (query.includes(vw) || hasFuzzyWord(query, [vw]))) {
        matchedVendor = item.vendor;
        break;
      }
    }
    if (matchedVendor) break;
  }

  // 6. STRICT FILTERING
  let candidates = [...listings];

  // VENDOR FILTER
  if (matchedVendor) {
    const vPrefix = matchedVendor.toLowerCase().split(' ')[0];
    const vendorMatches = candidates.filter((l) =>
      (l.vendor || '').toLowerCase().includes(vPrefix) || query.includes((l.vendor || '').toLowerCase())
    );
    candidates = vendorMatches;
  }

  // STRICT PRICE CEILING
  if (maxPrice !== null) {
    candidates = candidates.filter((item) => item.price <= maxPrice);
  }

  // CATEGORY FILTER
  // Rule: If an item has an explicit category (e.g. 'Meals'), keyword matches
  // in its name (e.g. 'brioche') must NOT override the explicit category.
  if (isBakery) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      if (cat && cat !== 'bakery') return false; // explicit non-bakery category — skip
      const name = item.name.toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return (
        cat === 'bakery' ||
        BAKERY_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
        hasFuzzyWord(`${name} ${desc}`, ['croissant', 'pastry', 'cake', 'bread'])
      );
    });
  } else if (isCafe) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      if (cat && cat !== 'cafe') return false;
      const name = item.name.toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return (
        cat === 'cafe' ||
        CAFE_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
        hasFuzzyWord(`${name} ${desc}`, ['coffee', 'sandwich', 'burger'])
      );
    });
  } else if (isMeals) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      if (cat && cat !== 'meals') return false;
      const name = item.name.toLowerCase();
      const desc = (item.description || '').toLowerCase();
      return (
        cat === 'meals' ||
        MEALS_KEYWORDS.some((k) => name.includes(k) || desc.includes(k)) ||
        hasFuzzyWord(`${name} ${desc}`, ['biryani', 'thali', 'curry', 'pizza'])
      );
    });
  }

  // STRICT VEG VS NON-VEG
  if (isNonVeg) {
    candidates = candidates.filter(isListingNonVeg);
    const specificMeats = NON_VEG_WORDS.filter((m) => query.includes(m) || hasFuzzyWord(query, [m]));
    if (specificMeats.length > 0) {
      const moreSpecific = candidates.filter((l) => {
        const text = `${l.name} ${l.description || ''}`.toLowerCase();
        return specificMeats.some((m) => text.includes(m) || hasFuzzyWord(text, [m]));
      });
      if (moreSpecific.length > 0) candidates = moreSpecific;
    }
  } else if (isVeg) {
    candidates = candidates.filter((item) => {
      if (isListingNonVeg(item)) return false;
      const tags = (item.dietaryTags || item.dietTags || []).map((t) => t.toLowerCase());
      const name = item.name.toLowerCase();
      return tags.some((t) => t.includes('veg') || t.includes('jain')) || name.includes('veg');
    });
  }

  if (isJain) {
    candidates = candidates.filter((item) => {
      if (isListingNonVeg(item)) return false;
      const tags = (item.dietaryTags || item.dietTags || []).map((t) => t.toLowerCase());
      const desc = (item.description || '').toLowerCase();
      return tags.some((t) => t.includes('jain')) || desc.includes('jain') || desc.includes('no onion');
    });
  }

  if (isVegan) {
    candidates = candidates.filter((item) => {
      if (isListingNonVeg(item)) return false;
      const tags = (item.dietaryTags || item.dietTags || []).map((t) => t.toLowerCase());
      return tags.some((t) => t.includes('vegan'));
    });
  }
  if (isEggless) {
    candidates = candidates.filter((item) => {
      const allergens = (item.allergens || []).map((a) => a.toLowerCase());
      const tags = (item.dietaryTags || item.dietTags || []).map((t) => t.toLowerCase());
      return (
        !allergens.includes('eggs') &&
        !allergens.includes('egg') &&
        (tags.some((t) => t.includes('eggless') || t.includes('egg_free')) || allergens.length === 0)
      );
    });
  }
  if (isNutFree) {
    candidates = candidates.filter((item) => {
      const allergens = (item.allergens || []).map((a) => a.toLowerCase());
      return (
        !allergens.includes('nuts') &&
        !allergens.includes('peanuts') &&
        !allergens.includes('tree nuts')
      );
    });
  }

  // AREA FILTER
  if (matchedArea) {
    const inArea = candidates.filter((item) => item.area.toLowerCase().includes(matchedArea!) || hasFuzzyWord(item.area, [matchedArea!]));
    candidates = inArea;
  }

  // SPECIFIC FOOD KEYWORDS (e.g. "biryani", "prawns", "pasta", "sushi", "tacos", etc.)
  const stopWords = new Set([
    'give', 'me', 'expensive', 'costly', 'priciest', 'premium', 'food', 'at', 'in', 'from',
    'restaurant', 'restaurent', 'hotel', 'cafe', 'bakery', 'meals', 'meal', 'dishes', 'dish',
    'item', 'items', 'surplus', 'deal', 'deals', 'find', 'show', 'any', 'please', 'the', 'for',
    'with', 'near', 'what', 'can', 'you', 'tell', 'display', 'options', 'today', 'now', 'there',
    'arent', 'none', 'results', 'save', 'plate', 'best', 'good', 'cheap', 'cheapest', 'under',
    'below', 'less', 'more', 'want', 'craving', 'like', 'some', 'sweet', 'sweets', 'dessert',
    'veg', 'vegetarian', 'non', 'nonveg', 'non-veg', 'jain', 'vegan', 'eggless', 'halal',
    'rs', 'inr', 'rupees'
  ]);
  const specificWords = query
    .split(/[^a-z]+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !stopWords.has(w) &&
        !NON_VEG_WORDS.includes(w) &&
        !(matchedVendor && matchedVendor.toLowerCase().includes(w)) &&
        !(matchedArea && matchedArea.includes(w)),
    );

  if (specificWords.length > 0) {
    const specificMatches = candidates.filter((item) => {
      const text = `${item.name} ${item.description || ''}`.toLowerCase();
      return specificWords.some((w) => text.includes(w) || hasFuzzyWord(text, [w]));
    });
    candidates = specificMatches;
  }

  // 7. SORTING STRATEGIES
  if (isExpensive) {
    candidates.sort((a, b) => b.price - a.price);
  } else if (isEndingSoon) {
    candidates.sort((a, b) => (a.quantity ?? 1) - (b.quantity ?? 1));
  } else if (isBestDeals) {
    candidates.sort((a, b) => (1 - b.price / b.originalPrice) - (1 - a.price / a.originalPrice));
  } else if (maxPrice !== null) {
    candidates.sort((a, b) => a.price - b.price);
  } else {
    candidates.sort((a, b) => 1 - b.price / b.originalPrice - (1 - a.price / a.originalPrice));
  }

  // 8. RESPONSE GENERATION (WHEN MATCHES EXIST)
  if (candidates.length > 0) {
    const topListings = candidates.slice(0, 3);
    const names = topListings.map((l) => {
      const discount = Math.round((1 - l.price / l.originalPrice) * 100);
      return `${l.name} (${formatRupees(l.price)}, ${discount}% off)`;
    }).join(', ');

    let reply = '';
    if (isExpensive && matchedVendor) {
      reply = `✨ Here are the top premium surplus dishes from ${matchedVendor}: ${names}. Fine dining at rescue prices!`;
    } else if (isExpensive) {
      reply = `✨ Here are our top gourmet surplus picks: ${names}. Premium meals rescued at incredible discounts!`;
    } else if (isEndingSoon) {
      reply = `⚡ Urgent deals ending soon! Reserve before pickup windows close: ${names}. Save food and grab a deal!`;
    } else if (isBestDeals) {
      const maxDiscount = Math.max(...topListings.map((l) => Math.round((1 - l.price / l.originalPrice) * 100)));
      reply = `🔥 Here are the biggest surplus discounts available right now (up to ${maxDiscount}% off): ${names}. Great food, huge savings!`;
    } else if (matchedVendor) {
      reply = `Found ${topListings.length} delicious surplus item${topListings.length > 1 ? 's' : ''} from ${matchedVendor}: ${names}!`;
    } else if (isJain) {
      reply = `Found ${topListings.length} delicious Jain-friendly deal${topListings.length > 1 ? 's' : ''}: ${names}!`;
    } else if (isNonVeg) {
      reply = `Found ${topListings.length} delicious non-veg surplus deal${topListings.length > 1 ? 's' : ''}: ${names}! Grab them before pickup ends.`;
    } else if (maxPrice !== null && isBakery) {
      reply = `Found ${topListings.length} fresh bakery deal${topListings.length > 1 ? 's' : ''} under ₹${maxPrice}: ${names}!`;
    } else if (maxPrice !== null) {
      reply = `Here are delicious surplus finds under ₹${maxPrice}: ${names}. All ready for pickup today!`;
    } else if (matchedArea) {
      reply = `Found great surplus options in ${topListings[0].area}: ${names}!`;
    } else {
      reply = `Here are top food rescue deals matching your request: ${names}.`;
    }
    return { reply, listingIds: topListings.map((l) => l.id) };
  }

  // 9. NO RESULTS FOUND - DISPLAY NONE RESULTS
  let noResultMsg = 'No matching surplus items found right now.';
  if (matchedVendor && (isBakery || isCafe || isMeals)) {
    const catLabel = isBakery ? 'sweets / bakery' : isCafe ? 'cafe snacks' : 'meals';
    noResultMsg = `No ${catLabel} surplus items found from ${matchedVendor} right now. Please check back later today!`;
  } else if (matchedVendor && specificWords.length > 0) {
    noResultMsg = `No surplus items found matching "${specificWords.join(' ')}" from ${matchedVendor} right now. Please check back later today!`;
  } else if (matchedVendor) {
    noResultMsg = `No surplus listings currently available from ${matchedVendor}. Please check back later today!`;
  } else if (maxPrice !== null && (isBakery || isCafe || isMeals)) {
    noResultMsg = `No ${isBakery ? 'bakery' : isCafe ? 'cafe' : 'meal'} items found under ₹${maxPrice} right now. Check back later as new surplus bags are posted!`;
  } else if (maxPrice !== null) {
    noResultMsg = `No surplus items found under ₹${maxPrice} right now. Check back later today as more surplus bags are added!`;
  } else if (isNonVeg) {
    noResultMsg = `No non-veg surplus items found matching your criteria right now. Please check back later today!`;
  } else if (isJain) {
    noResultMsg = `No Jain-friendly surplus items found matching your search right now. Please check back later today!`;
  } else if (isVegan) {
    noResultMsg = `No vegan surplus items found matching your search right now. Please check back later today!`;
  } else if (isVeg) {
    noResultMsg = `No vegetarian surplus items found matching your criteria right now. Please check back later today!`;
  } else if (matchedArea && specificWords.length > 0) {
    noResultMsg = `No surplus items found matching "${specificWords.join(' ')}" in ${matchedArea} right now. Please check back later!`;
  } else if (matchedArea) {
    noResultMsg = `No surplus items found in ${matchedArea} right now. Try checking nearby areas or check back later!`;
  } else if (specificWords.length > 0) {
    noResultMsg = `No surplus listings found matching "${specificWords.join(' ')}". Please check back later today as restaurants add new surplus bags!`;
  } else {
    noResultMsg = `No surplus listings found matching your request right now. Please check back later today as restaurants add new surplus bags!`;
  }

  return {
    reply: noResultMsg,
    listingIds: [],
  };
}

export function AIChatSheet({ visible, onClose, listings, userArea }: AIChatSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const chatMutation = useChatWithAssistant();

  // Scroll to bottom when new message arrives
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  useEffect(() => {
    if (visible && messages.length > 0) {
      scrollToBottom();
    }
  }, [visible, messages.length, scrollToBottom]);

  // Map listings to compact summaries for LLM context
  const listingSummaries = useRef<ActiveListingSummary[]>([]);
  useEffect(() => {
    listingSummaries.current = listings.slice(0, 40).map((l) => ({
      id: String(l.id),
      name: String(l.name || 'Surplus Item'),
      vendor: String(l.vendor || 'Local Vendor'),
      category: String(l.category || 'meals').toLowerCase(),
      price: Number(l.price) || 0,
      originalPrice: Number(l.originalPrice) || 0,
      area: String(l.area || 'Mumbai'),
      pickupWindow: String(l.pickupWindow || 'Today'),
      quantity: Number(l.quantity) || 1,
      dietaryTags: Array.isArray(l.dietaryTags)
        ? l.dietaryTags
        : Array.isArray(l.dietTags)
          ? l.dietTags
          : [],
      allergens: Array.isArray(l.allergens) ? l.allergens : [],
      description: String(l.description || ''),
    }));
  }, [listings]);

  // Listing lookup map
  const listingMap = useRef<Map<string, FoodListing>>(new Map());
  useEffect(() => {
    const map = new Map<string, FoodListing>();
    for (const item of listings) {
      map.set(item.id, item);
    }
    listingMap.current = map;
  }, [listings]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    setErrorMessage(null);
    setInputMessage('');
    Haptics.selectionAsync?.();

    const userMsg: ChatMessageItem = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    scrollToBottom();

    // Limit conversation payload to last 6 messages
    const apiMessages = nextMessages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await chatMutation.mutateAsync({
        data: {
          messages: apiMessages,
          listings: listingSummaries.current,
          now: new Date().toISOString(),
          timezone: 'Asia/Kolkata',
          userArea,
        },
      });

      const botMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-bot`,
        role: 'assistant',
        content: response.reply,
        listingIds: response.listingIds,
      };

      setMessages((prev) => [...prev, botMsg]);
      scrollToBottom();
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('[SaveBot] Chat backend error, activating smart local assistant:', err);
      // Seamless intelligent offline fallback — always responds with relevant food deals!
      const fallback = generateLocalSaveBotReply(text, listings, userArea);
      const botMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-bot`,
        role: 'assistant',
        content: fallback.reply,
        listingIds: fallback.listingIds,
      };

      setMessages((prev) => [...prev, botMsg]);
      scrollToBottom();
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleOpenListing = (id: string) => {
    onClose();
    router.push({ pathname: '/listing/[id]', params: { id } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.avatarPill}>
                <Text style={styles.avatarIcon}>🤖</Text>
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.foreground }]}>SaveBot</Text>
                  <View style={[styles.aiBadge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI CO-PILOT</Text>
                  </View>
                </View>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Your Mumbai food rescue assistant
                </Text>
              </View>
            </View>

            <Pressable
              hitSlop={12}
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.secondary }]}
              accessibilityLabel="Close SaveBot chat"
              accessibilityRole="button"
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>

          {/* Messages list */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={[styles.welcomeBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={styles.welcomeEmoji}>🌱</Text>
                  <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
                    Ask SaveBot anything!
                  </Text>
                  <Text style={[styles.welcomeBody, { color: colors.mutedForeground }]}>
                    "Find veg lunch under ₹150 near Bandra" or "Any eggless bakery deals closing soon?"
                  </Text>
                </View>

                <Text style={[styles.chipSectionTitle, { color: colors.mutedForeground }]}>
                  Try asking:
                </Text>
                <View style={styles.chipsContainer}>
                  {SUGGESTION_CHIPS.map((chipText) => (
                    <Pressable
                      key={chipText}
                      onPress={() => handleSendMessage(chipText)}
                      style={[
                        styles.suggestionChip,
                        { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.suggestionChipText, { color: colors.foreground }]}>
                        {chipText}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <View
                    key={m.id}
                    style={[
                      styles.messageRow,
                      isUser ? styles.messageRowUser : styles.messageRowBot,
                    ]}
                  >
                    {!isUser && (
                      <View style={styles.botAvatarSmall}>
                        <Text style={{ fontSize: 13 }}>🤖</Text>
                      </View>
                    )}

                    <View style={{ maxWidth: '85%' }}>
                      <View
                        style={[
                          styles.bubble,
                          isUser
                            ? [styles.bubbleUser, { backgroundColor: colors.primary }]
                            : [styles.bubbleBot, { backgroundColor: colors.card, borderColor: colors.border }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.bubbleText,
                            { color: isUser ? '#ffffff' : colors.foreground },
                          ]}
                        >
                          {m.content}
                        </Text>
                      </View>

                      {/* Zero Results Indicator */}
                      {!isUser && Array.isArray(m.listingIds) && m.listingIds.length === 0 && (
                        <View
                          style={[
                            styles.noResultsNotice,
                            { backgroundColor: colors.secondary, borderColor: colors.border },
                          ]}
                        >
                          <Feather name="search" size={12} color={colors.mutedForeground} />
                          <Text
                            style={[
                              styles.noResultsNoticeText,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            0 surplus listings found
                          </Text>
                        </View>
                      )}

                      {/* Matched Listing Cards */}
                      {!isUser && m.listingIds && m.listingIds.length > 0 && (
                        <View style={styles.listingCardsContainer}>
                          {m.listingIds.map((id) => {
                            const listing = listingMap.current.get(id);
                            if (!listing) return null;
                            const discount = Math.round(
                              (1 - listing.price / listing.originalPrice) * 100,
                            );

                            return (
                              <View
                                key={id}
                                style={[
                                  styles.compactListingCard,
                                  { backgroundColor: colors.secondary, borderColor: colors.border },
                                ]}
                              >
                                <View style={{ flex: 1, marginRight: 10 }}>
                                  <Text
                                    numberOfLines={1}
                                    style={[styles.listingName, { color: colors.foreground }]}
                                  >
                                    {listing.name}
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    style={[styles.listingVendor, { color: colors.mutedForeground }]}
                                  >
                                    {listing.vendor} · 📍 {listing.area}
                                  </Text>
                                  <View style={styles.priceRow}>
                                    <Text style={[styles.rescuePrice, { color: colors.primary }]}>
                                      {formatRupees(listing.price)}
                                    </Text>
                                    <Text
                                      style={[styles.originalPrice, { color: colors.mutedForeground }]}
                                    >
                                      {formatRupees(listing.originalPrice)}
                                    </Text>
                                    <Text style={styles.discountBadge}>{discount}% off</Text>
                                  </View>
                                </View>

                                <Pressable
                                  onPress={() => handleOpenListing(listing.id)}
                                  style={[styles.viewButton, { backgroundColor: colors.primary }]}
                                >
                                  <Text style={styles.viewButtonText}>View</Text>
                                </Pressable>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}

            {/* Typing indicator */}
            {chatMutation.isPending && (
              <View style={[styles.messageRow, styles.messageRowBot]}>
                <View style={styles.botAvatarSmall}>
                  <Text style={{ fontSize: 13 }}>🤖</Text>
                </View>
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleBot,
                    { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', gap: 6, alignItems: 'center' },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.typingText, { color: colors.mutedForeground }]}>
                    SaveBot is thinking...
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Error Banner */}
          {errorMessage && (
            <View style={[styles.errorBanner, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
              <Feather name="alert-circle" size={14} color="#b91c1c" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Input Row */}
          <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
            <TextInput
              value={inputMessage}
              onChangeText={setInputMessage}
              placeholder="Ask SaveBot about surplus deals..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
              editable={!chatMutation.isPending}
            />

            <Pressable
              onPress={() => handleSendMessage()}
              disabled={!inputMessage.trim() || chatMutation.isPending}
              style={[
                styles.sendBtn,
                {
                  backgroundColor:
                    inputMessage.trim() && !chatMutation.isPending
                      ? colors.primary
                      : colors.secondary,
                },
              ]}
              accessibilityLabel="Send message to SaveBot"
              accessibilityRole="button"
            >
              {chatMutation.isPending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Feather
                  name="arrow-up"
                  size={19}
                  color={inputMessage.trim() ? '#ffffff' : colors.mutedForeground}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85%',
    minHeight: 480,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6f4ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  aiBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 12,
  },
  welcomeBubble: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  welcomeBody: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  chipSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowBot: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  botAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e6f4ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  listingCardsContainer: {
    marginTop: 8,
    gap: 6,
  },
  compactListingCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingName: {
    fontSize: 12,
    fontWeight: '700',
  },
  listingVendor: {
    fontSize: 10,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  rescuePrice: {
    fontSize: 12,
    fontWeight: '700',
  },
  originalPrice: {
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1e5436',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  viewButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
  },
  viewButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  noResultsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  noResultsNoticeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 13,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
