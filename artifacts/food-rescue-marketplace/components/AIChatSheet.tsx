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
  '🥗 Veg food near me',
  '🥐 Bakery under ₹100',
  '⚡ Ending soon',
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

// Intelligent local fallback generator for offline resilience
function generateLocalSaveBotReply(
  prompt: string,
  listings: FoodListing[],
  userArea?: string,
): { reply: string; listingIds: string[] } {
  const query = prompt.toLowerCase();

  // 1. Dietary filters (strictly distinguish non-veg from veg)
  const isNonVeg =
    /\b(non[- ]?veg(?:etarian)?|no[- ]veg|not[- ]veg|mansahari|chicken|mutton|meat|fish|prawns?|kheema|keema|seafood|pork|bacon|lamb|gosht)\b/i.test(
      query,
    );
  const isVeg =
    !isNonVeg &&
    /(?<!no\s+|non[- ]?|not\s+)\b(veg|veggie|vegetarians?|shakahari|jain)\b/i.test(query);
  const isVegan = !isNonVeg && query.includes('vegan');
  const isEggless = query.includes('eggless') || query.includes('no egg') || query.includes('egg-free');
  const isNutFree =
    query.includes('nut-free') ||
    query.includes('no nut') ||
    query.includes('nut free') ||
    query.includes('without nuts');

  // 2. Category filters
  const isBakery =
    query.includes('bakery') ||
    query.includes('bread') ||
    query.includes('croissant') ||
    query.includes('cake') ||
    query.includes('pastry') ||
    query.includes('puff') ||
    query.includes('meetha') ||
    query.includes('dessert');
  const isCafe =
    query.includes('cafe') ||
    query.includes('coffee') ||
    query.includes('chai') ||
    query.includes('tea') ||
    query.includes('snack') ||
    query.includes('nashta') ||
    query.includes('sandwich');
  const isMeals =
    query.includes('meal') ||
    query.includes('lunch') ||
    query.includes('dinner') ||
    query.includes('thali') ||
    query.includes('biryani') ||
    query.includes('rice') ||
    query.includes('roti');

  // 3. Price filter
  let maxPrice: number | null = null;
  const priceMatch =
    query.match(/(?:under|below|sub|less than|within|₹|rs\.?|inr)\s*(\d+)/i) ||
    query.match(/(\d+)\s*(?:rs|rupees|inr|or less)/i);
  if (priceMatch) {
    maxPrice = parseInt(priceMatch[1], 10);
  }

  // 4. Mumbai areas
  const mumbaiAreas = [
    'bandra', 'khar', 'colaba', 'lower parel', 'dadar', 'juhu',
    'andheri', 'powai', 'santacruz', 'bkc', 'churchgate', 'marine drive',
    'worli', 'kemps corner', 'fort', 'byculla', 'vile parle',
  ];
  const matchedArea =
    mumbaiAreas.find((area) => query.includes(area)) ||
    (query.includes('near me') ? userArea?.toLowerCase() : undefined);

  // 1. Strict filtering
  let candidates = [...listings];

  // STRICT PRICE CEILING: Never return items exceeding maxPrice
  if (maxPrice !== null) {
    candidates = candidates.filter((item) => item.price <= maxPrice);
  }

  // CATEGORY FILTER
  if (isBakery) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      const name = item.name.toLowerCase();
      return (
        cat === 'bakery' ||
        name.includes('bread') ||
        name.includes('croissant') ||
        name.includes('cake') ||
        name.includes('cruffin') ||
        name.includes('pastry') ||
        name.includes('sourdough') ||
        name.includes('focaccia') ||
        name.includes('babka') ||
        name.includes('bun')
      );
    });
  } else if (isCafe) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      const name = item.name.toLowerCase();
      return (
        cat === 'cafe' ||
        name.includes('coffee') ||
        name.includes('sandwich') ||
        name.includes('snack') ||
        name.includes('chai') ||
        name.includes('tea')
      );
    });
  } else if (isMeals) {
    candidates = candidates.filter((item) => {
      const cat = (item.category || '').toLowerCase();
      const name = item.name.toLowerCase();
      return (
        cat === 'meals' ||
        name.includes('meal') ||
        name.includes('thali') ||
        name.includes('biryani') ||
        name.includes('box')
      );
    });
  }

  // STRICT VEG VS NON-VEG FILTER
  if (isNonVeg) {
    candidates = candidates.filter(isListingNonVeg);
    const specificMeats = [
      'chicken',
      'mutton',
      'kheema',
      'keema',
      'prawn',
      'prawns',
      'fish',
      'egg',
    ].filter((m) => query.includes(m));
    if (specificMeats.length > 0) {
      const moreSpecific = candidates.filter((l) => {
        const text = `${l.name} ${l.description || ''}`.toLowerCase();
        return specificMeats.some((m) => text.includes(m));
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

  // ADDITIONAL DIETARY FILTERS
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
    const inArea = candidates.filter((item) => item.area.toLowerCase().includes(matchedArea));
    if (inArea.length > 0) candidates = inArea;
  }

  // SORT
  if (maxPrice !== null) {
    candidates.sort((a, b) => a.price - b.price);
  } else {
    candidates.sort((a, b) => 1 - b.price / b.originalPrice - (1 - a.price / a.originalPrice));
  }

  // Case 1: Matching candidates found within constraints
  if (candidates.length > 0) {
    const topListings = candidates.slice(0, 3);
    const names = topListings.map((l) => `${l.name} (${formatRupees(l.price)})`).join(', ');
    let reply = '';
    if (isNonVeg) {
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

  // Case 2a: Non-veg requested but no exact sub-filter match
  if (isNonVeg) {
    const nonVegItems = listings.filter(isListingNonVeg);
    nonVegItems.sort((a, b) => a.price - b.price);
    const picked = nonVegItems.slice(0, 3);
    const names = picked.map((p) => `${p.name} (${formatRupees(p.price)})`).join(', ');
    const reply = picked.length > 0
      ? `No non-veg items available matching your exact criteria right now. The available non-veg options are: ${names}.`
      : `No non-veg surplus items are available right now. Please check back later today!`;
    return { reply, listingIds: picked.map((p) => p.id) };
  }

  // Case 2b: Budget limit was set but nothing matched under maxPrice
  if (maxPrice !== null) {
    let alternatives = [...listings];
    if (isBakery) {
      const catAlts = alternatives.filter((l) => (l.category || '').toLowerCase() === 'bakery');
      if (catAlts.length > 0) alternatives = catAlts;
    }
    alternatives.sort((a, b) => a.price - b.price);
    const lowest = alternatives[0];
    const picked = alternatives.slice(0, 3);
    const reply = lowest
      ? `No ${isBakery ? 'bakery' : 'surplus'} items available under ₹${maxPrice} right now. The lowest priced option is ${lowest.name} (${formatRupees(lowest.price)}). Here are the closest budget options:`
      : `No items found under ₹${maxPrice} right now. Check back later today as more surplus bags are added!`;
    return { reply, listingIds: picked.map((p) => p.id) };
  }

  // Case 3: Keyword search fallback
  const keywordMatches = listings.filter((item) => {
    const text = `${item.name} ${item.vendor} ${item.area} ${item.category}`.toLowerCase();
    const words = query.split(/\s+/).filter((w) => w.length > 2);
    return words.some((w) => text.includes(w));
  });

  const topListings = keywordMatches.length > 0 ? keywordMatches.slice(0, 3) : listings.slice(0, 2);
  const names = topListings.map((l) => `${l.name} (${formatRupees(l.price)})`).join(', ');
  return {
    reply: `Here are top food rescue options available today: ${names}.`,
    listingIds: topListings.map((l) => l.id),
  };
}

export function AIChatSheet({ visible, onClose, listings, userArea }: AIChatSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

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
