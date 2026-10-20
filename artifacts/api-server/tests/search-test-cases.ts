import type { SearchFiltersOutput } from "@workspace/api-zod";

export interface TestCase {
  id: number;
  query: string;
  type: "standard" | "typo" | "hinglish" | "vague" | "contradictory";
  description: string;
  expected: Partial<SearchFiltersOutput>;
}

export const TEST_CASES: TestCase[] = [
  // 1-6: Standard queries with prices, categories, areas
  {
    id: 1,
    query: "veg dinner under ₹150 near Bandra",
    type: "standard",
    description: "Standard veg dinner with budget and area",
    expected: {
      category: "meals",
      diet: ["veg"],
      maxPrice: 150,
      area: "Bandra",
    },
  },
  {
    id: 2,
    query: "eggless pastries in Powai below 200",
    type: "standard",
    description: "Eggless bakery item with maxPrice and area",
    expected: {
      category: "bakery",
      diet: ["egg_free"],
      maxPrice: 200,
      area: "Powai",
    },
  },
  {
    id: 3,
    query: "vegan snacks near me within 3km",
    type: "standard",
    description: "Vegan cafe snack near me with distance",
    expected: {
      category: "cafe",
      diet: ["vegan"],
      nearMe: true,
      maxDistanceKm: 3,
    },
  },
  {
    id: 4,
    query: "dinner in Colaba under 300",
    type: "standard",
    description: "Meals in Colaba with price cap",
    expected: {
      category: "meals",
      maxPrice: 300,
      area: "Colaba",
    },
  },
  {
    id: 5,
    query: "nut-free cookies in Lower Parel",
    type: "standard",
    description: "Allergen nut-free bakery in Lower Parel",
    expected: {
      category: "bakery",
      diet: ["nut_free"],
      area: "Lower Parel",
    },
  },
  {
    id: 6,
    query: "quick lunch under 100 rs in Dadar",
    type: "standard",
    description: "Budget meals in Dadar",
    expected: {
      category: "meals",
      maxPrice: 100,
      area: "Dadar",
    },
  },

  // 7-11: Hinglish queries
  {
    id: 7,
    query: "sasta veg khana Andheri mein",
    type: "hinglish",
    description: "Hinglish sasta veg khana in Andheri",
    expected: {
      category: "meals",
      diet: ["veg"],
      area: "Andheri",
      sortBy: "price",
    },
  },
  {
    id: 8,
    query: "meetha bakery snacks BKC ke paas",
    type: "hinglish",
    description: "Hinglish bakery snacks near BKC",
    expected: {
      category: "bakery",
      area: "BKC",
    },
  },
  {
    id: 9,
    query: "raat ko bakery items closing soon",
    type: "hinglish",
    description: "Hinglish night closing soon bakery",
    expected: {
      category: "bakery",
      sortBy: "ending_soon",
    },
  },
  {
    id: 10,
    query: "shakahari dabba Bandra mein",
    type: "hinglish",
    description: "Hinglish shakahari meal in Bandra",
    expected: {
      category: "meals",
      diet: ["veg"],
      area: "Bandra",
    },
  },
  {
    id: 11,
    query: "sasta chai aur snack Worli mein",
    type: "hinglish",
    description: "Hinglish sasta cafe in Worli",
    expected: {
      category: "cafe",
      area: "Worli",
      sortBy: "price",
    },
  },

  // 12-16: Typos and misspelled area names
  {
    id: 12,
    query: "veggie dinenr under 150 bndra",
    type: "typo",
    description: "Typos in dinner and Bandra",
    expected: {
      category: "meals",
      diet: ["veg"],
      maxPrice: 150,
      area: "Bandra",
    },
  },
  {
    id: 13,
    query: "powey cafes",
    type: "typo",
    description: "Typo in Powai",
    expected: {
      category: "cafe",
      area: "Powai",
    },
  },
  {
    id: 14,
    query: "sasta breadd",
    type: "typo",
    description: "Typo in bread",
    expected: {
      category: "bakery",
      sortBy: "price",
    },
  },
  {
    id: 15,
    query: "croissnt in juhu beach",
    type: "typo",
    description: "Typo in croissant in Juhu",
    expected: {
      category: "bakery",
      area: "Juhu",
    },
  },
  {
    id: 16,
    query: "veg piza under 200 in colba",
    type: "typo",
    description: "Typo in pizza and Colaba",
    expected: {
      diet: ["veg"],
      maxPrice: 200,
      area: "Colaba",
    },
  },

  // 17-21: Vague queries
  {
    id: 17,
    query: "something to eat",
    type: "vague",
    description: "Vague query with no specific filters",
    expected: {},
  },
  {
    id: 18,
    query: "food",
    type: "vague",
    description: "One-word vague query",
    expected: {},
  },
  {
    id: 19,
    query: "surprise bag near me",
    type: "vague",
    description: "Vague surprise bag near me",
    expected: {
      nearMe: true,
    },
  },
  {
    id: 20,
    query: "anything available right now",
    type: "vague",
    description: "Vague availability query",
    expected: {},
  },
  {
    id: 21,
    query: "quick bite",
    type: "vague",
    description: "Vague bite query",
    expected: {},
  },

  // 22-24: Contradictory queries
  {
    id: 22,
    query: "cheap expensive dinner",
    type: "contradictory",
    description: "Contradictory cheap vs expensive",
    expected: {
      category: "meals",
    },
  },
  {
    id: 23,
    query: "veg chicken biryani",
    type: "contradictory",
    description: "Contradictory veg and chicken",
    expected: {
      category: "meals",
    },
  },
  {
    id: 24,
    query: "under 100 but above 500",
    type: "contradictory",
    description: "Contradictory budget range",
    expected: {},
  },

  // 25-27: Additional area and edge queries
  {
    id: 25,
    query: "pure veg thali in Panvel",
    type: "standard",
    description: "Panvel veg meals",
    expected: {
      category: "meals",
      diet: ["veg"],
      area: "Panvel",
    },
  },
  {
    id: 26,
    query: "vashi bakery bags",
    type: "standard",
    description: "Vashi Navi Mumbai bakery items",
    expected: {
      category: "bakery",
      area: "Navi Mumbai/Vashi",
    },
  },
  {
    id: 27,
    query: "organic vegan cafe in Bandra West",
    type: "standard",
    description: "Vegan cafe in Bandra",
    expected: {
      category: "cafe",
      diet: ["vegan"],
      area: "Bandra",
    },
  },
  {
    id: 28,
    query: "veronicas cafe bandra",
    type: "standard",
    description: "Veronica's cafe in Bandra",
    expected: {
      category: "cafe",
      area: "Bandra",
    },
  },
];
