import { createHmac, timingSafeEqual } from "node:crypto";
import {
  and,
  desc,
  eq,
  gte,
  gt,
  inArray,
} from "drizzle-orm";
import { Router, type IRouter, type Response } from "express";
import {
  CreateListingBody,
  CreateOrderBody,
  GetListingsQueryParams,
  OrderStatusBody,
  PushDeviceBody,
  SendMessageBody,
  SuggestListingTagsBody,
  VerifyPickupBody,
} from "@workspace/api-zod";
import {
  db,
  listingsTable,
  messagesTable as marketplaceMessagesTable,
  ordersTable as marketplaceOrdersTable,
  pushDevicesTable,
  vendorFollowsTable,
  vendorsTable,
} from "@workspace/db";
import { requireUser } from "../middlewares/requireUser";
import { HttpError } from "../lib/http-error";
import { sendPushToUsers } from "../lib/push";
import { applyFilters } from "../lib/filter-query-builder";
import { checkSuggestRateLimit, suggestListingTags } from "../lib/llm-allergen-suggester";
import { checkContradictions } from "../lib/allergen-rule-checker";

const router: IRouter = Router();

const INDIA_MIDDAY = { latitude: 19.0593, longitude: 72.829 };
const ORDER_STATUSES = ["RESERVED", "PREPARING", "READY", "PICKED_UP"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

function userId(res: Response) {
  return res.locals.marketplaceUserId as string;
}

function coords(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return null;
  return { latitude: latitude / 1_000_000, longitude: longitude / 1_000_000 };
}

function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
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

function mapListing(
  listing: typeof listingsTable.$inferSelect,
  vendor: typeof vendorsTable.$inferSelect,
  distanceKm: number | null = null,
) {
  const point = coords(listing.latitude, listing.longitude);
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
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    dietaryTags: listing.dietaryTags,
    allergens: (listing.allergens as any) ?? [],
    mayContain: (listing.mayContain as any) ?? [],
    allergenInfoConfirmed: Boolean(listing.allergenInfoConfirmed),
    allergenConfirmedAt: listing.allergenConfirmedAt ? listing.allergenConfirmedAt.toISOString() : null,
    allergenConfirmedBy: listing.allergenConfirmedBy ?? null,
    aiSuggestion: listing.aiSuggestion ?? null,
    expiresAt: listing.expiresAt,
    createdAt: listing.createdAt,
    discountPercent: Math.round((1 - listing.price / listing.originalPrice) * 100),
    photo: listing.photo === "bakery" ? "bakery" as const : "lunch" as const,
  };
}

function mapOrder(order: typeof marketplaceOrdersTable.$inferSelect) {
  return {
    id: order.id,
    listingId: order.listingId,
    vendorId: order.vendorId,
    consumerUserId: order.consumerUserId,
    listingName: order.listingName,
    vendor: order.vendorName,
    pickupArea: order.pickupArea,
    pickupWindow: order.pickupWindow,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    originalUnitPrice: order.originalUnitPrice,
    totalPrice: order.totalPrice,
    status: ORDER_STATUSES.includes(order.status as OrderStatus)
      ? (order.status as OrderStatus)
      : "RESERVED",
    createdAt: order.createdAt,
    pickedUpAt: order.pickedUpAt,
  };
}

function pickupSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new HttpError(500, "Pickup QR signing is not configured.");
  return secret;
}

function pickupSignature(order: { id: string; consumerUserId: string; vendorId: string }) {
  return createHmac("sha256", pickupSecret())
    .update(`${order.id}:${order.consumerUserId}:${order.vendorId}`)
    .digest("hex");
}

function pickupPayload(order: typeof marketplaceOrdersTable.$inferSelect) {
  return JSON.stringify({
    orderId: order.id,
    signature: pickupSignature(order),
  });
}

async function getOwnedVendor(ownerUserId: string) {
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.ownerUserId, ownerUserId))
    .limit(1);
  return vendor;
}

async function userCanReadOrder(orderId: string, currentUserId: string) {
  const [result] = await db
    .select({ order: marketplaceOrdersTable, vendorOwner: vendorsTable.ownerUserId })
    .from(marketplaceOrdersTable)
    .innerJoin(vendorsTable, eq(vendorsTable.id, marketplaceOrdersTable.vendorId))
    .where(eq(marketplaceOrdersTable.id, orderId))
    .limit(1);
  if (!result) throw new HttpError(404, "Pickup not found.");
  if (result.order.consumerUserId !== currentUserId && result.vendorOwner !== currentUserId) {
    throw new HttpError(403, "You do not have access to this pickup.");
  }
  return result;
}

router.get("/me", requireUser, (_req, res) => {
  res.json({ id: userId(res) });
});

router.get("/listings", async (req, res) => {
  const rawDietary = req.query.dietary;
  const dietary =
    typeof rawDietary === "string"
      ? rawDietary.split(",").filter(Boolean)
      : Array.isArray(rawDietary)
        ? rawDietary.flatMap((value) => String(value).split(",")).filter(Boolean)
        : undefined;

  const rawAreas = (req.query as any).areas;
  const areas =
    typeof rawAreas === "string"
      ? rawAreas.split(",").map((a: string) => a.trim()).filter(Boolean)
      : Array.isArray(rawAreas)
        ? rawAreas.flatMap((value: any) => String(value).split(",")).map((a: string) => a.trim()).filter(Boolean)
        : undefined;

  const filters = GetListingsQueryParams.parse({ ...req.query, dietary, areas });

  const origin =
    filters.latitude !== undefined && filters.longitude !== undefined
      ? { latitude: filters.latitude, longitude: filters.longitude }
      : null;

  const results = await applyFilters(
    {
      q: filters.q,
      category: (filters.category?.toLowerCase() as "bakery" | "cafe" | "meals") || undefined,
      diet: (filters.dietary as any) || [],
      areas,
      maxPrice: filters.maxPrice,
      minDiscountPercent: filters.minDiscountPercent,
      maxDistanceKm: filters.maxDistanceKm,
      sortBy:
        filters.sort === "discount"
          ? ("price" as const)
          : filters.sort === "expiring"
            ? ("ending_soon" as const)
            : ("distance" as const),
    },
    origin,
  );

  res.json(results);
});

router.get("/vendor/listings", requireUser, async (_req, res) => {
  const vendor = await getOwnedVendor(userId(res));
  if (!vendor) {
    res.json([]);
    return;
  }
  const rows = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.vendorId, vendor.id))
    .orderBy(desc(listingsTable.createdAt));
  res.json(rows.map((listing) => mapListing(listing, vendor)));
});

router.post("/listings/suggest-tags", requireUser, async (req, res) => {
  const clientKey = userId(res) || req.ip || "unknown";
  if (!checkSuggestRateLimit(clientKey)) {
    throw new HttpError(429, "Too many tag suggestion requests. Please wait a moment.");
  }
  const input = SuggestListingTagsBody.parse(req.body);
  const result = await suggestListingTags({
    title: input.title,
    description: input.description,
    photo: input.imageUrl,
    clientIp: req.ip,
  });
  res.json(result);
});

router.post("/listings", requireUser, async (req, res) => {
  const input = CreateListingBody.parse(req.body);
  if (input.price >= input.originalPrice) {
    throw new HttpError(400, "The discounted price must be lower than the regular price.");
  }
  if (input.expiresAt <= new Date()) {
    throw new HttpError(400, "The pickup deadline must be in the future.");
  }

  // SAFETY PRINCIPLE: Vendor must confirm allergen and dietary information
  if (!input.allergenInfoConfirmed) {
    throw new HttpError(
      400,
      "Vendor must review and confirm allergen and dietary information before listing can be published.",
    );
  }

  // Deterministic contradiction check
  const contradictionResult = checkContradictions(
    input.name,
    input.description,
    (input.dietTags || []) as any,
    (input.allergens || []) as any,
  );
  if (contradictionResult.hasContradiction) {
    throw new HttpError(400, contradictionResult.blockingReasons.join("; "));
  }

  const ownerUserId = userId(res);
  const latitudeE6 =
    input.latitude === null ? null : Math.round(input.latitude * 1_000_000);
  const longitudeE6 =
    input.longitude === null ? null : Math.round(input.longitude * 1_000_000);
  const [vendor] = await db
    .insert(vendorsTable)
    .values({
      ownerUserId,
      name: input.vendor.trim(),
      city: "Mumbai",
      area: input.area.trim(),
      latitude: latitudeE6,
      longitude: longitudeE6,
    })
    .onConflictDoUpdate({
      target: vendorsTable.ownerUserId,
      set: {
        name: input.vendor.trim(),
        area: input.area.trim(),
        latitude: latitudeE6,
        longitude: longitudeE6,
      },
    })
    .returning();
  if (!vendor) throw new HttpError(500, "Could not create the vendor profile.");

  const [listing] = await db
    .insert(listingsTable)
    .values({
      vendorId: vendor.id,
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category,
      photo: input.photo,
      price: input.price,
      originalPrice: input.originalPrice,
      quantity: input.quantity,
      pickupWindow: input.pickupWindow.trim(),
      area: input.area.trim(),
      latitude: latitudeE6,
      longitude: longitudeE6,
      dietaryTags: input.dietaryTags,
      dietTags: input.dietTags ?? [],
      allergens: input.allergens ?? [],
      mayContain: input.mayContain ?? [],
      allergenInfoConfirmed: input.allergenInfoConfirmed,
      allergenConfirmedAt: new Date(),
      allergenConfirmedBy: ownerUserId,
      aiSuggestion: input.aiSuggestion ?? null,
      expiresAt: input.expiresAt,
    })
    .returning();
  if (!listing) throw new HttpError(500, "Could not publish the listing.");

  const followers = await db
    .select({ userId: vendorFollowsTable.consumerUserId })
    .from(vendorFollowsTable)
    .where(eq(vendorFollowsTable.vendorId, vendor.id));
  void sendPushToUsers(
    followers.map((row) => row.userId),
    {
      title: `${vendor.name} posted a new food find`,
      body: `${listing.name} is available for pickup in ${listing.area}.`,
      data: { type: "new_listing", listingId: listing.id },
    },
  );
  res.status(201).json(mapListing(listing, vendor));
});

router.get("/orders", requireUser, async (_req, res) => {
  const orders = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.consumerUserId, userId(res)))
    .orderBy(desc(marketplaceOrdersTable.createdAt));
  res.json(
    orders.map((order) => ({
      ...mapOrder(order),
      pickupQrPayload:
        order.status === "PICKED_UP" ? null : pickupPayload(order),
    })),
  );
});

router.post("/orders", requireUser, async (req, res) => {
  const input = CreateOrderBody.parse(req.body);
  let consumerUserId = userId(res) || "demo-consumer-1";
  if (consumerUserId.includes("vendor")) {
    consumerUserId = "demo-consumer-1";
  }
  const order = await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listingsTable)
      .where(eq(listingsTable.id, input.listingId))
      .for("update")
      .limit(1);
    if (
      !listing ||
      !listing.active ||
      listing.expiresAt <= new Date() ||
      listing.quantity < input.quantity
    ) {
      throw new HttpError(409, "This offer no longer has enough portions available.");
    }
    const [vendor] = await tx
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, listing.vendorId))
      .limit(1);
    if (!vendor) throw new HttpError(404, "The shop for this offer was not found.");
    if (vendor.ownerUserId === consumerUserId) {
      throw new HttpError(400, "You cannot reserve your own offer.");
    }

    await tx
      .update(listingsTable)
      .set({ quantity: listing.quantity - input.quantity })
      .where(eq(listingsTable.id, listing.id));
    const [created] = await tx
      .insert(marketplaceOrdersTable)
      .values({
        listingId: listing.id,
        vendorId: vendor.id,
        consumerUserId,
        listingName: listing.name,
        vendorName: vendor.name,
        pickupArea: listing.area,
        pickupWindow: listing.pickupWindow,
        quantity: input.quantity,
        unitPrice: listing.price,
        originalUnitPrice: listing.originalPrice,
        totalPrice: listing.price * input.quantity,
        status: "RESERVED",
      })
      .returning();
    if (!created) throw new HttpError(500, "Could not reserve this pickup.");
    return { created, vendor };
  });

  if (order.vendor.ownerUserId) {
    void sendPushToUsers([order.vendor.ownerUserId], {
      title: "New pickup reserved",
      body: `${order.created.quantity} × ${order.created.listingName} · ${order.created.pickupWindow}`,
      data: { type: "new_order", orderId: order.created.id },
    });
  }

  res.status(201).json({
    ...mapOrder(order.created),
    pickupQrPayload: pickupPayload(order.created),
  });
});

router.get("/vendor/orders", requireUser, async (_req, res) => {
  const vendor = await getOwnedVendor(userId(res));
  if (!vendor) {
    res.json([]);
    return;
  }
  const orders = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.vendorId, vendor.id))
    .orderBy(desc(marketplaceOrdersTable.createdAt));
  res.json(orders.map(mapOrder));
});

router.patch("/orders/:orderId/status", requireUser, async (req, res) => {
  const input = OrderStatusBody.parse(req.body);
  if (input.status !== "PREPARING" && input.status !== "READY") {
    throw new HttpError(400, "Pickup completion must be verified by scanning its QR code.");
  }
  const orderId = String(req.params.orderId);
  const currentUserId = userId(res);
  const [order] = await db
    .select({ order: marketplaceOrdersTable, vendorOwner: vendorsTable.ownerUserId })
    .from(marketplaceOrdersTable)
    .innerJoin(vendorsTable, eq(vendorsTable.id, marketplaceOrdersTable.vendorId))
    .where(eq(marketplaceOrdersTable.id, orderId))
    .limit(1);
  if (!order) throw new HttpError(404, "Pickup not found.");
  if (order.vendorOwner !== currentUserId) throw new HttpError(403, "This pickup belongs to another shop.");
  if (order.order.status === "PICKED_UP") throw new HttpError(409, "This pickup is already complete.");
  if (
    (input.status === "PREPARING" && order.order.status !== "RESERVED") ||
    (input.status === "READY" && order.order.status !== "PREPARING")
  ) {
    throw new HttpError(409, "Update the pickup status in order: reserved, preparing, then ready.");
  }
  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: input.status })
    .where(eq(marketplaceOrdersTable.id, orderId))
    .returning();
  if (!updated) throw new HttpError(500, "Could not update the pickup.");
  void sendPushToUsers([updated.consumerUserId], {
    title: input.status === "READY" ? "Your pickup is ready" : "Your order is being prepared",
    body: `${updated.listingName} at ${updated.vendorName}`,
    data: { type: "order_status", orderId: updated.id },
  });
  res.json(mapOrder(updated));
});

router.post("/orders/verify-pickup", requireUser, async (req, res) => {
  const input = VerifyPickupBody.parse(req.body);
  let qr: { orderId?: unknown; signature?: unknown };
  try {
    qr = JSON.parse(input.qrPayload) as { orderId?: unknown; signature?: unknown };
  } catch {
    throw new HttpError(400, "This is not a valid pickup QR code.");
  }
  if (typeof qr.orderId !== "string" || typeof qr.signature !== "string") {
    throw new HttpError(400, "This is not a valid pickup QR code.");
  }
  const [order] = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(eq(marketplaceOrdersTable.id, qr.orderId))
    .limit(1);
  if (!order) throw new HttpError(404, "Pickup not found.");
  const expected = Buffer.from(pickupSignature(order), "hex");
  const received = Buffer.from(qr.signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new HttpError(400, "The pickup QR code could not be verified.");
  }
  const vendor = await getOwnedVendor(userId(res));
  if (!vendor || vendor.id !== order.vendorId) {
    throw new HttpError(403, "Only the shop that received this order can verify it.");
  }
  if (order.status === "PICKED_UP") throw new HttpError(409, "This pickup has already been scanned.");
  if (order.status === "CANCELLED") throw new HttpError(409, "This pickup was cancelled.");

  const [updated] = await db
    .update(marketplaceOrdersTable)
    .set({ status: "PICKED_UP", pickedUpAt: new Date() })
    .where(
      and(
        eq(marketplaceOrdersTable.id, order.id),
        inArray(marketplaceOrdersTable.status, ["RESERVED", "PREPARING", "READY"]),
      ),
    )
    .returning();
  if (!updated) throw new HttpError(409, "This pickup has already been scanned.");
  void sendPushToUsers([updated.consumerUserId], {
    title: "Pickup complete — thanks for rescuing food",
    body: `You rescued ${updated.quantity} portion${updated.quantity === 1 ? "" : "s"} from ${updated.vendorName}.`,
    data: { type: "pickup_complete", orderId: updated.id },
  });
  res.json(mapOrder(updated));
});

async function findVendorByIdOrName(vendorParam: string) {
  const param = (vendorParam || "").trim();
  if (UUID_REGEX.test(param)) {
    const [found] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.id, param))
      .limit(1);
    if (found) return found;
  }
  // Try exact name match
  const [byName] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.name, param))
    .limit(1);
  if (byName) return byName;

  // Try normalized slug or lowercase match
  const allVendors = await db.select().from(vendorsTable);
  const cleanParam = param.replace(/^rest-/, "").toLowerCase().replace(/[^\w]/g, "");
  return (
    allVendors.find(
      (v) =>
        v.id === param ||
        v.name.toLowerCase() === param.toLowerCase() ||
        v.name.toLowerCase().replace(/[^\w]/g, "") === cleanParam,
    ) || null
  );
}

router.get("/vendors/following", requireUser, async (_req, res) => {
  let currentUserId = userId(res) || "demo-consumer-1";
  if (currentUserId.includes("vendor")) {
    currentUserId = "demo-consumer-1";
  }
  const followed = await db
    .select({
      vendorId: vendorsTable.id,
      name: vendorsTable.name,
      area: vendorsTable.area,
      city: vendorsTable.city,
      followedAt: vendorFollowsTable.createdAt,
    })
    .from(vendorFollowsTable)
    .innerJoin(vendorsTable, eq(vendorsTable.id, vendorFollowsTable.vendorId))
    .where(eq(vendorFollowsTable.consumerUserId, currentUserId))
    .orderBy(desc(vendorFollowsTable.createdAt));
  res.json(followed);
});

router.put("/vendors/:vendorId/follow", requireUser, async (req, res) => {
  const vendor = await findVendorByIdOrName(String(req.params.vendorId));
  if (!vendor) throw new HttpError(404, "Shop not found.");
  let currentUserId = userId(res) || "demo-consumer-1";
  if (currentUserId.includes("vendor")) {
    currentUserId = "demo-consumer-1";
  }
  if (vendor.ownerUserId === currentUserId) {
    throw new HttpError(400, "You cannot follow your own shop.");
  }
  const [follow] = await db
    .insert(vendorFollowsTable)
    .values({ consumerUserId: currentUserId, vendorId: vendor.id })
    .onConflictDoNothing()
    .returning();
  if (follow) {
    res.json({
      vendorId: vendor.id,
      name: vendor.name,
      area: vendor.area,
      city: vendor.city,
      followedAt: follow.createdAt,
    });
    return;
  }
  const [existing] = await db
    .select({ followedAt: vendorFollowsTable.createdAt })
    .from(vendorFollowsTable)
    .where(
      and(
        eq(vendorFollowsTable.consumerUserId, currentUserId),
        eq(vendorFollowsTable.vendorId, vendor.id),
      ),
    )
    .limit(1);
  res.json({
    vendorId: vendor.id,
    name: vendor.name,
    area: vendor.area,
    city: vendor.city,
    followedAt: existing?.followedAt ?? new Date(),
  });
});

router.delete("/vendors/:vendorId/follow", requireUser, async (req, res) => {
  const vendor = await findVendorByIdOrName(String(req.params.vendorId));
  if (!vendor) {
    res.status(204).end();
    return;
  }
  let currentUserId = userId(res) || "demo-consumer-1";
  if (currentUserId.includes("vendor")) {
    currentUserId = "demo-consumer-1";
  }
  await db
    .delete(vendorFollowsTable)
    .where(
      and(
        eq(vendorFollowsTable.consumerUserId, currentUserId),
        eq(vendorFollowsTable.vendorId, vendor.id),
      ),
    );
  res.status(204).end();
});

router.get("/vendor/analytics", requireUser, async (req, res) => {
  const period = req.query.period === "month" ? "month" : "week";
  const vendor = await getOwnedVendor(userId(res));
  if (!vendor) {
    res.json({
      period,
      rescuedPortions: 0,
      confirmedRevenueInr: 0,
      customerSavingsInr: 0,
      orderCount: 0,
      topItems: [],
      peakOrderHours: [],
    });
    return;
  }

  const since = new Date();
  if (period === "month") since.setDate(since.getDate() - 30);
  else since.setDate(since.getDate() - 7);
  const completed = await db
    .select()
    .from(marketplaceOrdersTable)
    .where(
      and(
        eq(marketplaceOrdersTable.vendorId, vendor.id),
        eq(marketplaceOrdersTable.status, "PICKED_UP"),
        gte(marketplaceOrdersTable.pickedUpAt, since),
      ),
    );

  const itemTotals = new Map<string, { portions: number; revenueInr: number }>();
  const hourCounts = new Map<number, number>();
  let rescuedPortions = 0;
  let confirmedRevenueInr = 0;
  let customerSavingsInr = 0;
  for (const order of completed) {
    rescuedPortions += order.quantity;
    confirmedRevenueInr += order.totalPrice;
    customerSavingsInr += (order.originalUnitPrice - order.unitPrice) * order.quantity;
    const item = itemTotals.get(order.listingName) ?? { portions: 0, revenueInr: 0 };
    item.portions += order.quantity;
    item.revenueInr += order.totalPrice;
    itemTotals.set(order.listingName, item);
    const indiaHour = Number(
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        hour12: false,
      }).format(order.createdAt),
    ) % 24;
    hourCounts.set(indiaHour, (hourCounts.get(indiaHour) ?? 0) + 1);
  }

  res.json({
    period,
    rescuedPortions,
    confirmedRevenueInr,
    customerSavingsInr,
    orderCount: completed.length,
    topItems: [...itemTotals.entries()]
      .map(([name, totals]) => ({ name, ...totals }))
      .sort((a, b) => b.portions - a.portions)
      .slice(0, 5),
    peakOrderHours: [...hourCounts.entries()]
      .map(([hour, orders]) => ({ hour, orders }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5),
  });
});

router.get("/orders/:orderId/messages", requireUser, async (req, res) => {
  const orderId = String(req.params.orderId);
  await userCanReadOrder(orderId, userId(res));
  const messages = await db
    .select()
    .from(marketplaceMessagesTable)
    .where(eq(marketplaceMessagesTable.orderId, orderId))
    .orderBy(marketplaceMessagesTable.createdAt);
  res.json(messages);
});

router.post("/orders/:orderId/messages", requireUser, async (req, res) => {
  const input = SendMessageBody.parse(req.body);
  const orderId = String(req.params.orderId);
  const currentUserId = userId(res);
  const { order, vendorOwner } = await userCanReadOrder(orderId, currentUserId);
  if (order.status === "CANCELLED") throw new HttpError(409, "Chat is closed for this pickup.");
  const body = input.body.trim();
  if (!body) throw new HttpError(400, "Write a message before sending.");
  const [message] = await db
    .insert(marketplaceMessagesTable)
    .values({ orderId, senderUserId: currentUserId, body })
    .returning();
  if (!message) throw new HttpError(500, "Could not send your message.");
  const recipientId =
    currentUserId === order.consumerUserId ? vendorOwner : order.consumerUserId;
  if (recipientId) {
    void sendPushToUsers([recipientId], {
      title: "New pickup message",
      body: body.slice(0, 120),
      data: { type: "chat_message", orderId },
    });
  }
  res.status(201).json(message);
});

router.post("/push-devices", requireUser, async (req, res) => {
  const input = PushDeviceBody.parse(req.body);
  if (!/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(input.token)) {
    throw new HttpError(400, "This does not look like a valid Expo push token.");
  }
  await db
    .insert(pushDevicesTable)
    .values({ token: input.token, userId: userId(res), platform: input.platform })
    .onConflictDoUpdate({
      target: pushDevicesTable.token,
      set: { userId: userId(res), platform: input.platform, createdAt: new Date() },
    });
  res.status(204).end();
});

router.delete("/push-devices", requireUser, async (req, res) => {
  const input = PushDeviceBody.parse(req.body);
  await db
    .delete(pushDevicesTable)
    .where(
      and(
        eq(pushDevicesTable.token, input.token),
        eq(pushDevicesTable.userId, userId(res)),
      ),
    );
  res.status(204).end();
});

// ==========================================
// DIRECT CLIENT SYNC ENDPOINTS (For Mobile App -> Drizzle PostgreSQL)
// ==========================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.post("/sync/order", requireUser, async (req, res) => {
  try {
    let consumerUserId = userId(res) || "demo-consumer-1";
    if (consumerUserId.includes("vendor")) {
      consumerUserId = "demo-consumer-1";
    }
    const {
      listingId,
      listingName,
      vendor: vendorNameInput,
      quantity = 1,
      unitPrice,
      originalUnitPrice,
      totalPrice,
      pickupWindow,
      pickupArea,
      status = "RESERVED",
    } = req.body;

    // 1. Find or create vendor
    const vName = (vendorNameInput || "Local Kitchen").trim();
    let [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.name, vName))
      .limit(1);

    if (!vendor) {
      const [newVendor] = await db
        .insert(vendorsTable)
        .values({
          name: vName,
          ownerUserId: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          city: "Mumbai",
          area: pickupArea || "Bandra West",
        })
        .returning();
      vendor = newVendor;
    }

    // 2. Find or create listing
    let listing = null;
    if (listingId && UUID_REGEX.test(listingId)) {
      const [found] = await db
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.id, listingId))
        .limit(1);
      listing = found;
    }

    if (!listing) {
      const [foundByName] = await db
        .select()
        .from(listingsTable)
        .where(and(eq(listingsTable.name, listingName), eq(listingsTable.vendorId, vendor.id)))
        .limit(1);
      listing = foundByName;
    }

    if (!listing) {
      const [createdListing] = await db
        .insert(listingsTable)
        .values({
          vendorId: vendor.id,
          name: listingName || "Surplus Rescue Item",
          description: "Fresh surplus meal portion reserved via mobile app",
          category: "Meals",
          photo: "lunch",
          price: Number(unitPrice) || 150,
          originalPrice: Number(originalUnitPrice) || 350,
          quantity: 10,
          pickupWindow: pickupWindow || "Today, 6:00 PM – 8:00 PM",
          area: pickupArea || vendor.area,
          dietaryTags: ["vegetarian"],
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          active: true,
        })
        .returning();
      listing = createdListing;
    }

    // 3. Create the order in marketplace_orders
    const qty = Math.max(1, Number(quantity) || 1);
    const uPrice = Number(unitPrice) || listing.price;
    const oPrice = Number(originalUnitPrice) || listing.originalPrice;
    const tPrice = Number(totalPrice) || (uPrice * qty);

    const [createdOrder] = await db
      .insert(marketplaceOrdersTable)
      .values({
        listingId: listing.id,
        vendorId: vendor.id,
        consumerUserId,
        listingName: listing.name,
        vendorName: vendor.name,
        pickupArea: pickupArea || listing.area,
        pickupWindow: pickupWindow || listing.pickupWindow,
        quantity: qty,
        unitPrice: uPrice,
        originalUnitPrice: oPrice,
        totalPrice: tPrice,
        status: status,
      })
      .returning();

    // 4. Decrement available quantity
    await db
      .update(listingsTable)
      .set({ quantity: Math.max(0, listing.quantity - qty) })
      .where(eq(listingsTable.id, listing.id));

    res.status(201).json({ success: true, order: createdOrder });
  } catch (error) {
    console.error("[sync/order] Failed to sync order:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/sync/order/status", requireUser, async (req, res) => {
  try {
    const { orderId, listingName, status = "PICKED_UP" } = req.body;
    let consumerUserId = userId(res) || "demo-consumer-1";
    if (consumerUserId.includes("vendor")) {
      consumerUserId = "demo-consumer-1";
    }
    const isPickedUp = status === "PICKED_UP";

    if (orderId && UUID_REGEX.test(orderId)) {
      const [updated] = await db
        .update(marketplaceOrdersTable)
        .set({
          status,
          pickedUpAt: isPickedUp ? new Date() : undefined,
        })
        .where(eq(marketplaceOrdersTable.id, orderId))
        .returning();
      if (updated) {
        res.json({ success: true, order: updated });
        return;
      }
    }

    // Fallback: update most recent active order matching listingName or for this user
    const [latestOrder] = await db
      .select()
      .from(marketplaceOrdersTable)
      .where(
        listingName
          ? and(
              eq(marketplaceOrdersTable.listingName, listingName),
              eq(marketplaceOrdersTable.status, "RESERVED"),
            )
          : and(
              eq(marketplaceOrdersTable.consumerUserId, consumerUserId),
              eq(marketplaceOrdersTable.status, "RESERVED"),
            )
      )
      .orderBy(desc(marketplaceOrdersTable.createdAt))
      .limit(1);

    if (latestOrder) {
      const [updated] = await db
        .update(marketplaceOrdersTable)
        .set({
          status,
          pickedUpAt: isPickedUp ? new Date() : undefined,
        })
        .where(eq(marketplaceOrdersTable.id, latestOrder.id))
        .returning();
      res.json({ success: true, order: updated });
      return;
    }

    res.json({ success: false, message: "No matching pending order found to update" });
  } catch (error) {
    console.error("[sync/order/status] Failed to update order status:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/sync/orders/batch", requireUser, async (req, res) => {
  try {
    let consumerUserId = userId(res) || "demo-consumer-1";
    if (consumerUserId.includes("vendor")) {
      consumerUserId = "demo-consumer-1";
    }
    const ordersList = Array.isArray(req.body.orders) ? req.body.orders : [];
    const results = [];

    for (const item of ordersList) {
      const vName = (item.vendor || "Local Kitchen").trim();
      let [vendor] = await db
        .select()
        .from(vendorsTable)
        .where(eq(vendorsTable.name, vName))
        .limit(1);

      if (!vendor) {
        const [newVendor] = await db
          .insert(vendorsTable)
          .values({
            name: vName,
            ownerUserId: `owner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            city: "Mumbai",
            area: item.pickupArea || item.area || "Bandra West",
          })
          .returning();
        vendor = newVendor;
      }

      let listing = null;
      if (item.listingId && UUID_REGEX.test(item.listingId)) {
        const [found] = await db
          .select()
          .from(listingsTable)
          .where(eq(listingsTable.id, item.listingId))
          .limit(1);
        listing = found;
      }

      if (!listing && item.listingName) {
        const [foundByName] = await db
          .select()
          .from(listingsTable)
          .where(and(eq(listingsTable.name, item.listingName), eq(listingsTable.vendorId, vendor.id)))
          .limit(1);
        listing = foundByName;
      }

      if (!listing) {
        const [createdListing] = await db
          .insert(listingsTable)
          .values({
            vendorId: vendor.id,
            name: item.listingName || "Surplus Rescue Item",
            description: "Fresh surplus meal portion reserved via mobile app",
            category: "Meals",
            photo: "lunch",
            price: Number(item.unitPrice) || 150,
            originalPrice: Number(item.originalUnitPrice) || 350,
            quantity: 10,
            pickupWindow: item.pickupWindow || "Today, 6:00 PM – 8:00 PM",
            area: item.pickupArea || item.area || vendor.area,
            dietaryTags: ["vegetarian"],
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
            active: true,
          })
          .returning();
        listing = createdListing;
      }

      const isCollected = Boolean(item.collected || item.status === "PICKED_UP");
      const orderStatus = isCollected ? "PICKED_UP" : (item.status || "RESERVED");

      const [existing] = await db
        .select()
        .from(marketplaceOrdersTable)
        .where(
          and(
            eq(marketplaceOrdersTable.listingId, listing.id),
            eq(marketplaceOrdersTable.consumerUserId, consumerUserId),
          )
        )
        .limit(1);

      if (existing) {
        if (existing.status !== orderStatus) {
          const [updated] = await db
            .update(marketplaceOrdersTable)
            .set({
              status: orderStatus,
              pickedUpAt: isCollected ? (existing.pickedUpAt || new Date()) : null,
            })
            .where(eq(marketplaceOrdersTable.id, existing.id))
            .returning();
          results.push(updated);
        } else {
          results.push(existing);
        }
      } else {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const uPrice = Number(item.unitPrice) || listing.price;
        const oPrice = Number(item.originalUnitPrice) || listing.originalPrice;
        const tPrice = Number(item.totalPrice) || (uPrice * qty);

        const [createdOrder] = await db
          .insert(marketplaceOrdersTable)
          .values({
            listingId: listing.id,
            vendorId: vendor.id,
            consumerUserId,
            listingName: listing.name,
            vendorName: vendor.name,
            pickupArea: item.pickupArea || item.area || listing.area,
            pickupWindow: item.pickupWindow || listing.pickupWindow,
            quantity: qty,
            unitPrice: uPrice,
            originalUnitPrice: oPrice,
            totalPrice: tPrice,
            status: orderStatus,
            pickedUpAt: isCollected ? new Date() : null,
          })
          .returning();
        results.push(createdOrder);
      }
    }

    res.json({ success: true, count: results.length, orders: results });
  } catch (error) {
    console.error("[sync/orders/batch] Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post("/sync/listing", requireUser, async (req, res) => {
  try {
    const ownerUserId = userId(res) || "demo-vendor-1";
    const {
      name,
      description,
      vendor: vendorName,
      category = "Bakery",
      price,
      originalPrice,
      quantity = 1,
      pickupWindow = "Today, 6:00 PM – 8:00 PM",
      area = "Bandra West",
      latitude,
      longitude,
      dietaryTags = [],
      dietTags = [],
      allergens = [],
      mayContain = [],
      allergenInfoConfirmed = true,
      photo = "lunch",
    } = req.body;

    const latE6 = typeof latitude === "number" ? Math.round(latitude * 1_000_000) : null;
    const lngE6 = typeof longitude === "number" ? Math.round(longitude * 1_000_000) : null;

    let [vendor] = await db
      .select()
      .from(vendorsTable)
      .where(eq(vendorsTable.name, (vendorName || "Local Kitchen").trim()))
      .limit(1);

    if (!vendor) {
      const [newVendor] = await db
        .insert(vendorsTable)
        .values({
          name: (vendorName || "Local Kitchen").trim(),
          ownerUserId,
          city: "Mumbai",
          area: area.trim(),
          latitude: latE6,
          longitude: lngE6,
        })
        .returning();
      vendor = newVendor;
    }

    const [listing] = await db
      .insert(listingsTable)
      .values({
        vendorId: vendor.id,
        name: name.trim(),
        description: (description || "").trim(),
        category,
        photo: photo === "bakery" ? "bakery" : "lunch",
        price: Number(price),
        originalPrice: Number(originalPrice),
        quantity: Math.max(1, Number(quantity)),
        pickupWindow: pickupWindow.trim(),
        area: area.trim(),
        latitude: latE6,
        longitude: lngE6,
        dietaryTags: Array.isArray(dietaryTags) ? dietaryTags : [],
        dietTags: Array.isArray(dietTags) ? dietTags : [],
        allergens: Array.isArray(allergens) ? allergens : [],
        mayContain: Array.isArray(mayContain) ? mayContain : [],
        allergenInfoConfirmed: Boolean(allergenInfoConfirmed),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        active: true,
      })
      .returning();

    res.status(201).json({ success: true, listing });
  } catch (error) {
    console.error("[sync/listing] Failed to create listing:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
