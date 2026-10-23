import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql, SQL } from "drizzle-orm";
import type { SearchFiltersOutput as SearchFiltersType } from "@workspace/api-zod";
import { db, listingsTable, vendorsTable } from "@workspace/db";
import { resolveMumbaiArea } from "./mumbai-areas";

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export function haversineDistanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDiff = radians(to.latitude - from.latitude);
  const lonDiff = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(lonDiff / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

/**
 * Builds and executes the Drizzle query applying all search and manual filters
 */
export async function applyFilters(
  filters: Partial<SearchFiltersType> & {
    q?: string;
    minDiscountPercent?: number;
  },
  userLocation?: UserLocation | null,
) {
  const conditions: SQL[] = [
    eq(listingsTable.active, true),
    gt(listingsTable.quantity, 0),
    gt(listingsTable.expiresAt, new Date()),
    eq(vendorsTable.city, "Mumbai"),
  ];

  // 1. Category filter
  if (filters.category) {
    const catLower = filters.category.toLowerCase();
    conditions.push(sql`lower(${listingsTable.category}) = ${catLower}`);
  }

  // 2. Max Price filter (vs discounted rescue price)
  if (filters.maxPrice !== undefined && filters.maxPrice > 0) {
    conditions.push(lte(listingsTable.price, filters.maxPrice));
  }

  // 3. Pickup After datetime filter
  if (filters.pickupAfter) {
    const afterDate = new Date(filters.pickupAfter);
    if (!isNaN(afterDate.getTime())) {
      conditions.push(gte(listingsTable.expiresAt, afterDate));
    }
  }

  // 4. Dietary tags filter (strictly explicit vendor tags via array overlaps/contains)
  // SAFETY PRINCIPLE: When filtering by dietary tag or allergen exclusion, unconfirmed listings MUST NEVER match.
  if (filters.diet && filters.diet.length > 0) {
    conditions.push(eq(listingsTable.allergenInfoConfirmed, true));
    const expandedTags: string[] = [];
    for (const d of filters.diet) {
      if (d === "veg" || (d as string) === "vegetarian") {
        expandedTags.push("veg", "vegetarian", "jain");
      } else if (d === "vegan") {
        expandedTags.push("vegan");
      } else if (d === "egg_free") {
        expandedTags.push("egg_free", "eggless", "egg-free");
      } else if (d === "nut_free") {
        expandedTags.push("nut_free", "nut-free");
      } else if ((d as string) === "jain") {
        expandedTags.push("jain");
      } else if ((d as string) === "halal") {
        expandedTags.push("halal");
      } else {
        expandedTags.push(d);
      }
    }
    // PostgreSQL array overlap: listingsTable.dietary_tags && ARRAY[...]::text[]
    conditions.push(sql`${listingsTable.dietaryTags} && ${expandedTags}::text[]`);
  }

  // 4b. Allergen exclusion filter: unconfirmed listings must never match
  if (filters.excludeAllergens && filters.excludeAllergens.length > 0) {
    conditions.push(eq(listingsTable.allergenInfoConfirmed, true));
    const excluded = filters.excludeAllergens as string[];
    conditions.push(sql`NOT (${listingsTable.allergens} && ${excluded}::text[])`);
    conditions.push(sql`NOT (${listingsTable.mayContain} && ${excluded}::text[])`);
  }

  // 5. Area resolution (supports multi-area or single area)
  let resolvedAreaCoords: UserLocation | null = null;
  const targetAreas =
    filters.areas && filters.areas.length > 0
      ? filters.areas
      : filters.area
        ? [filters.area]
        : [];

  if (targetAreas.length > 0) {
    const areaConds: SQL[] = [];
    for (const areaStr of targetAreas) {
      const resolved = resolveMumbaiArea(areaStr);
      if (resolved) {
        if (!resolvedAreaCoords) {
          resolvedAreaCoords = { latitude: resolved.latitude, longitude: resolved.longitude };
        }
        areaConds.push(
          or(
            ilike(listingsTable.area, `%${resolved.canonicalName}%`),
            ...resolved.aliases.slice(0, 3).map((alias) => ilike(listingsTable.area, `%${alias}%`)),
          )!,
        );
      } else {
        areaConds.push(ilike(listingsTable.area, `%${areaStr}%`));
      }
    }
    if (areaConds.length > 0) {
      conditions.push(or(...areaConds)!);
    }
  }

  // 5b. Min Discount Percent filter
  if (filters.minDiscountPercent !== undefined && filters.minDiscountPercent > 0) {
    conditions.push(
      sql`ROUND((1.0 - (${listingsTable.price}::numeric / NULLIF(${listingsTable.originalPrice}, 0)::numeric)) * 100) >= ${filters.minDiscountPercent}`,
    );
  }

  // 6. Keywords filter
  const allKeywords: string[] = [];
  if (filters.keywords && filters.keywords.length > 0) {
    allKeywords.push(...filters.keywords);
  }
  if (filters.q && filters.q.trim()) {
    allKeywords.push(...filters.q.trim().split(/\s+/).filter(Boolean));
  }

  if (allKeywords.length > 0) {
    const keywordConditions = allKeywords.map((kw) => {
      const term = `%${kw.toLowerCase()}%`;
      return or(
        sql`lower(${listingsTable.name}) LIKE ${term}`,
        sql`lower(${listingsTable.description}) LIKE ${term}`,
        sql`lower(${listingsTable.area}) LIKE ${term}`,
        sql`lower(${vendorsTable.name}) LIKE ${term}`,
      )!;
    });
    conditions.push(and(...keywordConditions)!);
  }

  // 7. Distance reference origin (user's GPS or resolved area coordinates)
  const origin: UserLocation | null =
    (filters.nearMe && userLocation) || userLocation || resolvedAreaCoords || null;

  // 8. Distance filter via PostGIS ST_DWithin if origin & maxDistanceKm are set
  if (origin && filters.maxDistanceKm !== undefined && filters.maxDistanceKm > 0) {
    const maxMeters = filters.maxDistanceKm * 1000;
    try {
      conditions.push(
        sql`ST_DWithin(
          ST_SetSRID(ST_MakePoint(${listingsTable.longitude} / 1000000.0, ${listingsTable.latitude} / 1000000.0), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${origin.longitude}, ${origin.latitude}), 4326)::geography,
          ${maxMeters}
        )`,
      );
    } catch {
      // PostGIS fallback will be applied during memory mapping
    }
  }

  // Execute query with Drizzle
  const query = db
    .select({ listing: listingsTable, vendor: vendorsTable })
    .from(listingsTable)
    .innerJoin(vendorsTable, eq(vendorsTable.id, listingsTable.vendorId))
    .where(and(...conditions));

  let rows;
  try {
    rows = await query;
  } catch (dbErr) {
    // If PostGIS function is unavailable in a bare Postgres setup without postgis, re-run without ST_DWithin
    const safeConditions = conditions.filter(
      (c) => !JSON.stringify(c).includes("ST_DWithin"),
    );
    rows = await db
      .select({ listing: listingsTable, vendor: vendorsTable })
      .from(listingsTable)
      .innerJoin(vendorsTable, eq(vendorsTable.id, listingsTable.vendorId))
      .where(and(...safeConditions));
  }

  // Map results and compute distances
  let results = rows.map(({ listing, vendor }) => {
    const lat = listing.latitude !== null ? listing.latitude / 1_000_000 : null;
    const lng = listing.longitude !== null ? listing.longitude / 1_000_000 : null;
    const itemCoord = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null;
    const distanceKm = origin && itemCoord ? haversineDistanceKm(origin, itemCoord) : null;
    const discountPercent = Math.round((1 - listing.price / listing.originalPrice) * 100);

    return {
      id: listing.id,
      vendorId: vendor.id,
      name: listing.name,
      description: listing.description,
      vendor: vendor.name,
      category: listing.category,
      price: listing.price,
      originalPrice: listing.originalPrice,
      quantity: listing.quantity,
      pickupWindow: listing.pickupWindow,
      area: listing.area,
      distance: distanceKm === null ? "Set location for distance" : `${distanceKm.toFixed(1)} km`,
      distanceKm,
      latitude: lat,
      longitude: lng,
      dietaryTags: listing.dietaryTags,
      allergens: (listing.allergens as any) ?? [],
      mayContain: (listing.mayContain as any) ?? [],
      allergenInfoConfirmed: Boolean(listing.allergenInfoConfirmed),
      allergenConfirmedAt: listing.allergenConfirmedAt ? listing.allergenConfirmedAt.toISOString() : null,
      allergenConfirmedBy: listing.allergenConfirmedBy ?? null,
      aiSuggestion: listing.aiSuggestion ?? null,
      expiresAt: listing.expiresAt,
      createdAt: listing.createdAt,
      discountPercent,
      photo: listing.photo === "bakery" ? ("bakery" as const) : ("lunch" as const),
    };
  });

  // Post-query filtering for allergen exclusion, minDiscountPercent, and maxDistanceKm
  if (filters.excludeAllergens && filters.excludeAllergens.length > 0) {
    const toExclude = new Set(filters.excludeAllergens as string[]);
    results = results.filter((r) => {
      const containsExcluded = (r.allergens || []).some((a: string) => toExclude.has(a));
      const mayContainExcluded = (r.mayContain || []).some((a: string) => toExclude.has(a));
      return !containsExcluded && !mayContainExcluded;
    });
  }

  // Post-query filtering for minDiscountPercent and maxDistanceKm if fallback was used
  if (filters.minDiscountPercent !== undefined) {
    results = results.filter((r) => r.discountPercent >= filters.minDiscountPercent!);
  }
  if (filters.maxDistanceKm !== undefined && origin) {
    results = results.filter((r) => r.distanceKm !== null && r.distanceKm <= filters.maxDistanceKm!);
  }

  // Sorting
  const sortBy = filters.sortBy || "distance";
  if (sortBy === "price") {
    results.sort((a, b) => a.price - b.price);
  } else if (sortBy === "ending_soon") {
    results.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  } else if (sortBy === "popular") {
    results.sort((a, b) => a.quantity - b.quantity);
  } else {
    // distance
    if (origin) {
      results.sort(
        (a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER),
      );
    } else {
      results.sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    }
  }

  return results;
}
