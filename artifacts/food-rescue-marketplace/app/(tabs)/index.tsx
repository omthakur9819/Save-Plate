import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { RestaurantCard } from '@/components/RestaurantCard';
import { AppMode, FoodCategory, FoodListing, useMarketplace } from '@/context/MarketplaceContext';
import { useColors } from '@/hooks/useColors';
import { useParseNaturalSearch, type SearchFilters } from '@workspace/api-client-react';

const categories: Array<FoodCategory | 'All'> = ['All', 'Bakery', 'Cafe', 'Meals'];

function InsetHeader({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? 67 : 0;
  return (
    <View style={{ paddingTop: Math.max(insets.top, webTop) + 10 }}>
      {children}
    </View>
  );
}

interface FilterChipItem {
  id: string;
  label: string;
  onRemove: () => void;
}

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, restaurants, currentUser, favorites, toggleFavorite, mode, setMode } = useMarketplace();
  const [viewMode, setViewMode] = useState<'restaurants' | 'dishes'>('restaurants');
  const [category, setCategory] = useState<FoodCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [savedOnly, setSavedOnly] = useState(false);

  // Natural-Language Filter State
  const [activeFilters, setActiveFilters] = useState<SearchFilters | null>(null);
  const [lastExecutedQuery, setLastExecutedQuery] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parseSearchMutation = useParseNaturalSearch();

  // Trigger LLM Search Parse
  const handleExecuteNaturalSearch = useCallback(
    async (queryText: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) {
        setActiveFilters(null);
        setLastExecutedQuery('');
        return;
      }
      if (trimmed === lastExecutedQuery) return;

      try {
        setLastExecutedQuery(trimmed);
        const result = await parseSearchMutation.mutateAsync({
          data: {
            query: trimmed,
            now: new Date().toISOString(),
            timezone: 'Asia/Kolkata',
          },
        });
        setActiveFilters(result);
        Haptics.selectionAsync?.();
      } catch (err) {
        console.warn('[NaturalSearch] parse fallback to keywords:', err);
        setActiveFilters({
          keywords: trimmed.split(/\s+/).filter(Boolean),
          diet: [],
          nearMe: false,
          sortBy: 'distance',
        });
      }
    },
    [lastExecutedQuery, parseSearchMutation],
  );

  // 600ms debounce timer when typing
  const handleSearchChange = (text: string) => {
    setSearch(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim()) {
      setActiveFilters(null);
      setLastExecutedQuery('');
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      handleExecuteNaturalSearch(text);
    }, 600);
  };

  const handleSearchSubmit = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    handleExecuteNaturalSearch(search);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Filter listings based on structured filters (or fallback search)
  const filterListings = useCallback(
    (sourceListings: FoodListing[], filters: SearchFilters | null) => {
      return sourceListings.filter((listing) => {
        if (listing.quantity <= 0) return false;
        if (savedOnly && !favorites.includes(listing.id)) return false;

        // Manual category tab
        if (!filters?.category && category !== 'All' && listing.category !== category) {
          return false;
        }

        // Natural language filters if present
        if (filters) {
          // Category
          if (filters.category) {
            const reqCat = filters.category.toLowerCase();
            if (listing.category.toLowerCase() !== reqCat) return false;
          }

          // Max Price
          if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
            if (listing.price > filters.maxPrice) return false;
          }

          // Diet tags
          // SAFETY CRITICAL RULE: Unconfirmed listings must NEVER match dietary filters!
          if (filters.diet && filters.diet.length > 0) {
            if (!listing.allergenInfoConfirmed) return false;

            const itemDietTags = new Set(
              [...(listing.dietaryTags || []), ...(listing.dietTags || [])].map((t) => t.toLowerCase())
            );

            const matchesDiet = filters.diet.every((d) => {
              if (d === 'veg') {
                return (
                  itemDietTags.has('veg') ||
                  itemDietTags.has('vegetarian') ||
                  itemDietTags.has('jain')
                );
              }
              if (d === 'vegan') {
                return itemDietTags.has('vegan');
              }
              if (d === 'egg_free') {
                return (
                  itemDietTags.has('egg_free') ||
                  itemDietTags.has('eggless') ||
                  itemDietTags.has('egg-free')
                );
              }
              if (d === 'jain') {
                return itemDietTags.has('jain');
              }
              if (d === 'halal') {
                return itemDietTags.has('halal');
              }
              return itemDietTags.has(d.toLowerCase());
            });
            if (!matchesDiet) return false;
          }

          // Allergen exclusion filters
          // SAFETY CRITICAL RULE: Unconfirmed listings must NEVER match allergen exclusion filters!
          if (filters.excludeAllergens && filters.excludeAllergens.length > 0) {
            if (!listing.allergenInfoConfirmed) return false;

            const containsAllergens = (listing.allergens || []).map((a) => a.toLowerCase());
            const tracesAllergens = (listing.mayContain || []).map((a) => a.toLowerCase());

            const hasExcludedAllergen = filters.excludeAllergens.some((ex) => {
              const exLower = ex.toLowerCase();
              return containsAllergens.includes(exLower) || tracesAllergens.includes(exLower);
            });
            if (hasExcludedAllergen) return false;
          }

          // Area
          if (filters.area) {
            const cleanArea = filters.area.toLowerCase();
            if (!listing.area.toLowerCase().includes(cleanArea)) return false;
          }

          // Keywords
          if (filters.keywords && filters.keywords.length > 0) {
            const haystack = `${listing.name} ${listing.vendor} ${listing.area} ${listing.description}`.toLowerCase();
            const matchesKeywords = filters.keywords.some((kw) => haystack.includes(kw.toLowerCase()));
            if (!matchesKeywords) return false;
          }
        } else if (search.trim()) {
          // Plain text substring search when no active LLM filters
          const haystack = `${listing.name} ${listing.vendor} ${listing.area}`.toLowerCase();
          if (!haystack.includes(search.trim().toLowerCase())) return false;
        }

        return true;
      });
    },
    [category, favorites, savedOnly, search],
  );

  // Sorting
  const sortListings = useCallback((items: FoodListing[], sortBy?: string) => {
    const copy = [...items];
    if (sortBy === 'price') {
      return copy.sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'ending_soon') {
      return copy;
    }
    return copy;
  }, []);

  // Compute matched listings and handle relaxation if 0 results
  const { matchedListings, relaxedMessage } = useMemo(() => {
    const directMatches = filterListings(listings, activeFilters);

    if (directMatches.length > 0 || !activeFilters) {
      return {
        matchedListings: sortListings(directMatches, activeFilters?.sortBy),
        relaxedMessage: null,
      };
    }

    // Relax the strictest filter when 0 direct matches
    let relaxed = { ...activeFilters };
    let message = '';

    if (relaxed.maxPrice !== undefined) {
      const oldPrice = relaxed.maxPrice;
      delete relaxed.maxPrice;
      const trial = filterListings(listings, relaxed);
      if (trial.length > 0) {
        return {
          matchedListings: sortListings(trial, relaxed.sortBy),
          relaxedMessage: `No results under ₹${oldPrice}. Showing delicious finds above ₹${oldPrice}.`,
        };
      }
    }

    if (relaxed.diet && relaxed.diet.length > 0) {
      const oldDiet = relaxed.diet.join(', ');
      relaxed.diet = [];
      const trial = filterListings(listings, relaxed);
      if (trial.length > 0) {
        return {
          matchedListings: sortListings(trial, relaxed.sortBy),
          relaxedMessage: `No exact ${oldDiet} items right now. Showing all nearby surplus treats.`,
        };
      }
    }

    if (relaxed.area) {
      const oldArea = relaxed.area;
      delete relaxed.area;
      const trial = filterListings(listings, relaxed);
      if (trial.length > 0) {
        return {
          matchedListings: sortListings(trial, relaxed.sortBy),
          relaxedMessage: `No listings currently active in ${oldArea}. Showing finds across Mumbai.`,
        };
      }
    }

    if (relaxed.category) {
      const oldCat = relaxed.category;
      delete relaxed.category;
      const trial = filterListings(listings, relaxed);
      if (trial.length > 0) {
        return {
          matchedListings: sortListings(trial, relaxed.sortBy),
          relaxedMessage: `No surplus ${oldCat} items right now. Showing all available food categories.`,
        };
      }
    }

    return {
      matchedListings: [],
      relaxedMessage: null,
    };
  }, [activeFilters, filterListings, listings, sortListings]);

  // Derive restaurants matching the active filters / search
  const matchedRestaurants = useMemo(() => {
    const matchedListingIds = new Set(matchedListings.map((l) => l.id));
    return restaurants
      .map((r) => {
        const relevantDishes = r.dishes.filter((d) => matchedListingIds.has(d.id));
        return {
          ...r,
          dishes: relevantDishes,
        };
      })
      .filter((r) => r.dishes.length > 0);
  }, [restaurants, matchedListings]);

  // Build removable chips from active filters
  const filterChips = useMemo<FilterChipItem[]>(() => {
    if (!activeFilters) return [];
    const chips: FilterChipItem[] = [];

    if (activeFilters.category) {
      chips.push({
        id: 'category',
        label: `Category: ${activeFilters.category.charAt(0).toUpperCase() + activeFilters.category.slice(1)}`,
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, category: undefined } : null)),
      });
    }

    if (activeFilters.maxPrice) {
      chips.push({
        id: 'maxPrice',
        label: `Under ₹${activeFilters.maxPrice}`,
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, maxPrice: undefined } : null)),
      });
    }

    if (activeFilters.area) {
      chips.push({
        id: 'area',
        label: `Area: ${activeFilters.area}`,
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, area: undefined } : null)),
      });
    }

    if (activeFilters.diet && activeFilters.diet.length > 0) {
      for (const d of activeFilters.diet) {
        const title =
          d === 'veg'
            ? '🌱 Veg'
            : d === 'vegan'
              ? '🌿 Vegan'
              : d === 'egg_free'
                ? '🥚 Egg-Free'
                : d === 'jain'
                  ? '✨ Jain'
                  : d === 'halal'
                    ? '☪️ Halal'
                    : d;
        chips.push({
          id: `diet-${d}`,
          label: title,
          onRemove: () =>
            setActiveFilters((prev) =>
              prev ? { ...prev, diet: (prev.diet || []).filter((item) => item !== d) } : null,
            ),
        });
      }
    }

    if (activeFilters.excludeAllergens && activeFilters.excludeAllergens.length > 0) {
      for (const ex of activeFilters.excludeAllergens) {
        const title = `No ${ex.charAt(0).toUpperCase() + ex.slice(1)}`;
        chips.push({
          id: `exclude-${ex}`,
          label: title,
          onRemove: () =>
            setActiveFilters((prev) =>
              prev
                ? {
                    ...prev,
                    excludeAllergens: (prev.excludeAllergens || []).filter((item) => item !== ex),
                  }
                : null,
            ),
        });
      }
    }

    if (activeFilters.nearMe) {
      chips.push({
        id: 'nearMe',
        label: 'Near Me',
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, nearMe: false } : null)),
      });
    }

    if (activeFilters.maxDistanceKm) {
      chips.push({
        id: 'distance',
        label: `Within ${activeFilters.maxDistanceKm}km`,
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, maxDistanceKm: undefined } : null)),
      });
    }

    if (activeFilters.sortBy && activeFilters.sortBy !== 'distance') {
      chips.push({
        id: 'sort',
        label: activeFilters.sortBy === 'price' ? 'Lowest Price' : 'Ending Soon',
        onRemove: () => setActiveFilters((prev) => (prev ? { ...prev, sortBy: 'distance' } : null)),
      });
    }

    if (activeFilters.keywords && activeFilters.keywords.length > 0) {
      for (const kw of activeFilters.keywords) {
        chips.push({
          id: `kw-${kw}`,
          label: `"${kw}"`,
          onRemove: () =>
            setActiveFilters((prev) =>
              prev ? { ...prev, keywords: (prev.keywords || []).filter((item) => item !== kw) } : null,
            ),
        });
      }
    }

    return chips;
  }, [activeFilters]);

  const openListing = (id: string) => {
    router.push({ pathname: '/listing/[id]', params: { id } });
  };

  const clearAllFilters = () => {
    setActiveFilters(null);
    setSearch('');
    setLastExecutedQuery('');
    Haptics.selectionAsync?.();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 102 : Math.max(insets.bottom, 12) + 94 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <InsetHeader>
          <View style={styles.topLine}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.primary }]}>
                SAVE PLATE
              </Text>
              <Text style={[styles.location, { color: colors.foreground }]}>
                Mumbai <Feather name="chevron-down" size={17} color={colors.foreground} />
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Account / Login Pill Button */}
              <Pressable
                onPress={() => router.push('/login')}
                style={[styles.authPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Account and Login"
                testID="account-button"
              >
                <Feather
                  name={currentUser ? (currentUser.role === 'vendor' ? 'briefcase' : 'user') : 'log-in'}
                  size={13}
                  color={colors.primary}
                />
                <Text style={[styles.authPillText, { color: colors.foreground }]} numberOfLines={1}>
                  {currentUser
                    ? currentUser.role === 'vendor'
                      ? (currentUser.restaurantName || currentUser.name)
                      : currentUser.name.split(' ')[0]
                    : 'Sign In'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const next: AppMode = mode === 'shopper' ? 'vendor' : 'shopper';
                  setMode(next);
                  Haptics.selectionAsync?.();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${mode === 'shopper' ? 'vendor' : 'shopper'} mode`}
                style={[styles.modeSwitch, { backgroundColor: colors.secondary }]}
                testID="mode-switch"
              >
                <Feather
                  name={mode === 'shopper' ? 'shopping-bag' : 'briefcase'}
                  size={14}
                  color={colors.secondaryForeground}
                />
                <Text style={[styles.modeText, { color: colors.secondaryForeground }]}>
                  {mode === 'shopper' ? 'Shopper' : 'Vendor'}
                </Text>
                <Feather name="repeat" size={13} color={colors.secondaryForeground} />
              </Pressable>
            </View>
          </View>
        </InsetHeader>

        <View style={styles.headlineBlock}>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {mode === 'shopper' ? 'A good find.\nA little less waste.' : 'Your extra food\nhas a next stop.'}
          </Text>
          <Text style={[styles.subhead, { color: colors.mutedForeground }]}>
            {mode === 'shopper'
              ? 'Try: "veg dinner under ₹150 near Bandra" or "sasta bakery"'
              : 'Give today’s unsold favorites a second chance.'}
          </Text>
        </View>

        {/* Natural-Language Search Box */}
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={handleSearchChange}
            onSubmitEditing={handleSearchSubmit}
            placeholder="Search with AI: 'veg dinner under ₹150 in Bandra'..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
            accessibilityLabel="Search food and vendors"
            testID="search-listings"
          />
          {parseSearchMutation.isPending && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
          )}
          {search.length > 0 && (
            <Pressable
              onPress={clearAllFilters}
              style={{ padding: 6, marginRight: 2 }}
              accessibilityLabel="Clear search"
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={savedOnly ? 'Show all food' : 'Show saved food'}
            onPress={() => setSavedOnly((value) => !value)}
            style={[styles.searchFilter, savedOnly && { backgroundColor: colors.accent }]}
            testID="saved-filter"
          >
            <Feather
              name="heart"
              size={16}
              color={savedOnly ? colors.primary : colors.secondaryForeground}
            />
          </Pressable>
        </View>

        {/* Removable Parsed Filter Chips */}
        {filterChips.length > 0 && (
          <View style={styles.activeChipsContainer}>
            <View style={styles.activeChipsHeader}>
              <Text style={[styles.activeChipsTitle, { color: colors.mutedForeground }]}>
                Parsed Filters:
              </Text>
              <Pressable onPress={clearAllFilters} testID="clear-filters">
                <Text style={[styles.clearAllText, { color: colors.primary }]}>Clear all</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activeChipsRow}
            >
              {filterChips.map((chip) => (
                <View
                  key={chip.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                  ]}
                  testID={`filter-chip-${chip.id}`}
                >
                  <Text style={[styles.filterChipText, { color: colors.foreground }]}>
                    {chip.label}
                  </Text>
                  <Pressable
                    onPress={() => {
                      chip.onRemove();
                      Haptics.selectionAsync?.();
                    }}
                    style={styles.chipRemoveBtn}
                    accessibilityLabel={`Remove filter ${chip.label}`}
                  >
                    <Feather name="x" size={13} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categories.map((item) => {
            const active = (activeFilters?.category ? activeFilters.category.toLowerCase() === item.toLowerCase() : category === item);
            return (
              <Pressable
                key={item}
                onPress={() => {
                  setCategory(item);
                  if (activeFilters) {
                    setActiveFilters((prev) =>
                      prev
                        ? {
                            ...prev,
                            category: item === 'All' ? undefined : (item.toLowerCase() as any),
                          }
                        : null,
                    );
                  }
                }}
                style={[
                  styles.chip,
                  { backgroundColor: active ? colors.foreground : colors.card, borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                testID={`category-${item.toLowerCase()}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.background : colors.secondaryForeground }]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Quick Safety & Dietary Filters Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dietFiltersRow}
        >
          {[
            { id: 'veg', type: 'diet' as const, label: '🌱 Veg' },
            { id: 'vegan', type: 'diet' as const, label: '🌿 Vegan' },
            { id: 'jain', type: 'diet' as const, label: '✨ Jain' },
            { id: 'halal', type: 'diet' as const, label: '☪️ Halal' },
            { id: 'milk', type: 'allergen' as const, label: '🥛 No Dairy' },
            { id: 'peanuts', type: 'allergen' as const, label: '🥜 No Peanuts' },
            { id: 'tree_nuts', type: 'allergen' as const, label: '🌰 No Tree Nuts' },
            { id: 'gluten', type: 'allergen' as const, label: '🌾 No Gluten' },
          ].map((item) => {
            const isDietActive = item.type === 'diet' && (activeFilters?.diet || []).includes(item.id as any);
            const isAllergenActive =
              item.type === 'allergen' && (activeFilters?.excludeAllergens || []).includes(item.id as any);
            const isActive = isDietActive || isAllergenActive;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  Haptics.selectionAsync?.();
                  if (item.type === 'diet') {
                    setActiveFilters((prev) => {
                      const cur = prev?.diet || [];
                      const next = cur.includes(item.id as any)
                        ? cur.filter((d) => d !== item.id)
                        : [...cur, item.id as any];
                      return {
                        keywords: prev?.keywords || [],
                        diet: next,
                        excludeAllergens: prev?.excludeAllergens || [],
                        nearMe: prev?.nearMe || false,
                        sortBy: prev?.sortBy || 'distance',
                        category: prev?.category,
                        maxPrice: prev?.maxPrice,
                        area: prev?.area,
                      };
                    });
                  } else {
                    setActiveFilters((prev) => {
                      const cur = prev?.excludeAllergens || [];
                      const next = cur.includes(item.id as any)
                        ? cur.filter((a) => a !== item.id)
                        : [...cur, item.id as any];
                      return {
                        keywords: prev?.keywords || [],
                        diet: prev?.diet || [],
                        excludeAllergens: next,
                        nearMe: prev?.nearMe || false,
                        sortBy: prev?.sortBy || 'distance',
                        category: prev?.category,
                        maxPrice: prev?.maxPrice,
                        area: prev?.area,
                      };
                    });
                  }
                }}
                style={[
                  styles.dietFilterChip,
                  {
                    backgroundColor: isActive ? '#1e5436' : colors.card,
                    borderColor: isActive ? '#1e5436' : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dietFilterChipText,
                    { color: isActive ? '#ffffff' : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Relaxed Filter Notice Banner */}
        {relaxedMessage && (
          <View style={[styles.relaxedNotice, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={[styles.relaxedNoticeText, { color: colors.foreground }]}>
              {relaxedMessage}
            </Text>
          </View>
        )}

        {/* View Mode Switcher: By Restaurant vs All Dishes */}
        <View style={[styles.viewModeToggle, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Pressable
            onPress={() => {
              setViewMode('restaurants');
              Haptics.selectionAsync?.();
            }}
            style={[
              styles.viewModeBtn,
              viewMode === 'restaurants' && {
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'restaurants' }}
            testID="view-by-restaurants"
          >
            <Feather
              name="home"
              size={13}
              color={viewMode === 'restaurants' ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                { color: viewMode === 'restaurants' ? colors.foreground : colors.mutedForeground },
                viewMode === 'restaurants' && { fontWeight: '700' },
              ]}
            >
              By Restaurant ({matchedRestaurants.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setViewMode('dishes');
              Haptics.selectionAsync?.();
            }}
            style={[
              styles.viewModeBtn,
              viewMode === 'dishes' && {
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'dishes' }}
            testID="view-all-dishes"
          >
            <Feather
              name="grid"
              size={13}
              color={viewMode === 'dishes' ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                { color: viewMode === 'dishes' ? colors.foreground : colors.mutedForeground },
                viewMode === 'dishes' && { fontWeight: '700' },
              ]}
            >
              All Dishes ({matchedListings.length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {savedOnly
                ? 'Saved for later'
                : activeFilters
                  ? 'Search Results'
                  : viewMode === 'restaurants'
                    ? 'Restaurants with Surplus'
                    : 'Near you today'}
            </Text>
            <Text style={[styles.sectionCaption, { color: colors.mutedForeground }]}>
              {viewMode === 'restaurants'
                ? `${matchedRestaurants.length} ${matchedRestaurants.length === 1 ? 'restaurant' : 'restaurants'} · ${matchedListings.length} total dishes`
                : `${matchedListings.length} fresh ${matchedListings.length === 1 ? 'find' : 'finds'} · pickup today`}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/map')}
            accessibilityRole="button"
            style={styles.mapLink}
            testID="see-map"
          >
            <Feather name="map" size={15} color={colors.primary} />
            <Text style={[styles.mapLinkText, { color: colors.primary }]}>Map</Text>
          </Pressable>
        </View>

        {viewMode === 'restaurants' ? (
          matchedRestaurants.length > 0 ? (
            matchedRestaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))
          ) : (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="coffee" size={25} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No restaurants matching right now
              </Text>
              <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
                Try switching to "All Dishes" or clearing some filters above.
              </Text>
            </View>
          )
        ) : matchedListings.length > 0 ? (
          matchedListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              favorite={favorites.includes(listing.id)}
              onPress={() => openListing(listing.id)}
              onFavorite={() => {
                toggleFavorite(listing.id);
                Haptics.selectionAsync?.();
              }}
            />
          ))
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={savedOnly ? 'heart' : 'search'} size={25} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {savedOnly ? 'Nothing saved yet' : 'No matches just yet'}
            </Text>
            <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
              {savedOnly
                ? 'Tap the heart on a food find to keep it close.'
                : 'Try adjusting your budget, distance, or search terms.'}
            </Text>
          </View>
        )}

        <View style={[styles.impact, { backgroundColor: colors.accent }]}>
          <Feather name="sun" size={19} color={colors.secondaryForeground} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.impactTitle, { color: colors.foreground }]}>A small save goes a long way</Text>
            <Text style={[styles.impactCopy, { color: colors.secondaryForeground }]}>
              Every pickup keeps good food in the neighborhood.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  location: { fontSize: 15, fontWeight: '700', marginTop: 5 },
  authPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    maxWidth: 140,
  },
  authPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modeSwitch: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 9 },
  modeText: { fontSize: 11, fontWeight: '700' },
  viewModeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
    gap: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headlineBlock: { marginTop: 25, marginBottom: 18 },
  headline: { fontSize: 32, lineHeight: 37, letterSpacing: -0.9, fontWeight: '700' },
  subhead: { marginTop: 7, fontSize: 13, lineHeight: 19 },
  searchBox: { height: 52, borderRadius: 17, borderWidth: 1, paddingLeft: 15, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 8 },
  searchFilter: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: 8, paddingTop: 10, paddingBottom: 18 },
  chip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 15, paddingVertical: 9 },
  chipText: { fontSize: 11, fontWeight: '700' },
  activeChipsContainer: { marginTop: 10, marginBottom: 4 },
  activeChipsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  activeChipsTitle: { fontSize: 11, fontWeight: '600' },
  clearAllText: { fontSize: 11, fontWeight: '700' },
  activeChipsRow: { gap: 8, paddingVertical: 4 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingLeft: 11, paddingRight: 7, paddingVertical: 6 },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  chipRemoveBtn: { padding: 2 },
  relaxedNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  relaxedNoticeText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionCaption: { fontSize: 11, marginTop: 4 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 },
  mapLinkText: { fontWeight: '700', fontSize: 12 },
  empty: { borderWidth: 1, borderRadius: 22, alignItems: 'center', padding: 26, marginBottom: 18 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyCopy: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5, maxWidth: 245 },
  impact: { borderRadius: 19, padding: 15, marginTop: 2, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  impactTitle: { fontWeight: '700', fontSize: 12 },
  impactCopy: { fontSize: 11, marginTop: 3, lineHeight: 16 },
  dietFiltersRow: {
    gap: 6,
    paddingBottom: 14,
  },
  dietFilterChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  dietFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
