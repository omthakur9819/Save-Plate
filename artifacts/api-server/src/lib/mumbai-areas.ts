export interface MumbaiAreaRecord {
  canonicalName: string;
  latitude: number;
  longitude: number;
  aliases: string[];
}

export const MUMBAI_AREAS: MumbaiAreaRecord[] = [
  {
    canonicalName: "Bandra",
    latitude: 19.0596,
    longitude: 72.8295,
    aliases: [
      "bandra",
      "bandra west",
      "bandra east",
      "bandstand",
      "pali hill",
      "carter road",
      "linking road",
      "ranwar",
      "hill road",
    ],
  },
  {
    canonicalName: "BKC",
    latitude: 19.0657,
    longitude: 72.8687,
    aliases: ["bkc", "bandra kurla complex", "kurla complex", "b.k.c."],
  },
  {
    canonicalName: "Andheri",
    latitude: 19.1197,
    longitude: 72.8464,
    aliases: [
      "andheri",
      "andheri west",
      "andheri east",
      "lokhandwala",
      "versova",
      "seven bungalows",
      "four bungalows",
      "dn nagar",
    ],
  },
  {
    canonicalName: "Powai",
    latitude: 19.1176,
    longitude: 72.906,
    aliases: ["powai", "hiranandani", "hiranandani powai", "chandivali", "iit bombay"],
  },
  {
    canonicalName: "Colaba",
    latitude: 18.9067,
    longitude: 72.8147,
    aliases: ["colaba", "cuffe parade", "nariman point", "churchgate", "fort", "marine drive"],
  },
  {
    canonicalName: "Lower Parel",
    latitude: 18.9953,
    longitude: 72.8315,
    aliases: ["lower parel", "high street phoenix", "palladium", "prabhadevi", "kamala mills"],
  },
  {
    canonicalName: "Juhu",
    latitude: 19.1075,
    longitude: 72.8263,
    aliases: ["juhu", "juhu beach", "juhu scheme", "vile parle west"],
  },
  {
    canonicalName: "Dadar",
    latitude: 19.0178,
    longitude: 72.8478,
    aliases: ["dadar", "dadar west", "dadar east", "shivaji park", "matunga", "mahim"],
  },
  {
    canonicalName: "Worli",
    latitude: 19.0166,
    longitude: 72.8166,
    aliases: ["worli", "worli sea face", "haji ali", "pedder road", "breach candy"],
  },
  {
    canonicalName: "Navi Mumbai/Vashi",
    latitude: 19.0771,
    longitude: 72.9986,
    aliases: ["navi mumbai", "vashi", "sanpada", "nerul", "belapur", "koperkhairane"],
  },
  {
    canonicalName: "Panvel",
    latitude: 18.9894,
    longitude: 73.1175,
    aliases: ["panvel", "new panvel", "khandeshwar", "kamothe", "kharghar"],
  },
];

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function cleanString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves an area name string against the known Mumbai areas using
 * exact, substring, alias, and fuzzy (Levenshtein) matching.
 */
export function resolveMumbaiArea(rawArea: string | null | undefined): MumbaiAreaRecord | null {
  if (!rawArea) return null;
  const input = cleanString(rawArea);
  if (!input) return null;

  // 1. Exact match on canonicalName or aliases
  for (const area of MUMBAI_AREAS) {
    if (cleanString(area.canonicalName) === input) return area;
    if (area.aliases.some((alias) => cleanString(alias) === input)) return area;
  }

  // 2. Substring containment match (e.g., "near Bandra station" contains "bandra")
  for (const area of MUMBAI_AREAS) {
    if (input.includes(cleanString(area.canonicalName))) return area;
    for (const alias of area.aliases) {
      const cleanedAlias = cleanString(alias);
      if (input.includes(cleanedAlias) || cleanedAlias.includes(input)) {
        return area;
      }
    }
  }

  // 3. Word token overlap (excluding generic area modifiers)
  const stopWords = new Set(["new", "near", "west", "east", "road", "complex", "street", "park", "sea", "face", "north", "south"]);
  const inputWords = input.split(" ").filter((w) => w.length > 2 && !stopWords.has(w));
  if (inputWords.length > 0) {
    for (const area of MUMBAI_AREAS) {
      for (const word of inputWords) {
        if (
          cleanString(area.canonicalName).split(" ").includes(word) ||
          area.aliases.some((alias) =>
            alias.split(" ").filter((aw) => !stopWords.has(aw)).includes(word)
          )
        ) {
          return area;
        }
      }
    }
  }

  // 4. Fuzzy distance for typos (e.g. "Bndra" -> "Bandra", "Powey" -> "Powai")
  let bestMatch: MumbaiAreaRecord | null = null;
  let minDistance = 2; // Strict edit distance of 1-2 for typos

  for (const area of MUMBAI_AREAS) {
    const cName = cleanString(area.canonicalName);
    if (Math.abs(input.length - cName.length) <= 2) {
      const distCanonical = levenshteinDistance(input, cName);
      if (distCanonical <= minDistance) {
        minDistance = distCanonical;
        bestMatch = area;
      }
    }
    for (const alias of area.aliases) {
      const aName = cleanString(alias);
      if (Math.abs(input.length - aName.length) <= 2) {
        const dist = levenshteinDistance(input, aName);
        if (dist <= minDistance) {
          minDistance = dist;
          bestMatch = area;
        }
      }
    }
  }

  return bestMatch;
}
