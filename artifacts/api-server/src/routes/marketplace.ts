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
  const filters = GetListingsQueryParams.parse({ ...req.query, dietary });
  const rows = await db
    .select({ listing: listingsTable, vendor: vendorsTable })
    .from(listingsTable)
    .innerJoin(vendorsTable, eq(vendorsTable.id, listingsTable.vendorId))
    .where(
      and(
        eq(listingsTable.active, true),
        gt(listingsTable.quantity, 0),
        gt(listingsTable.expiresAt, new Date()),
        eq(vendorsTable.city, "Mumbai"),
      ),
    );

  const search = filters.q?.trim().toLocaleLowerCase();
  const origin =
    filters.latitude !== undefined && filters.longitude !== undefined
      ? { latitude: filters.latitude, longitude: filters.longitude }
      : null;
  const listings = rows
    .map(({ listing, vendor }) => {
      const point = coords(listing.latitude, listing.longitude);
      const distanceKm = point && origin ? haversineKm(origin, point) : null;
      return { listing, vendor, result: mapListing(listing, vendor, distanceKm) };
    })
    .filter(({ listing, vendor, result }) => {
      if (filters.category && listing.category !== filters.category) return false;
      if (
        filters.dietary?.length &&
        !filters.dietary.some((tag) => listing.dietaryTags.includes(tag))
      ) return false;
      if (filters.maxPrice !== undefined && listing.price > filters.maxPrice) return false;
      if (
        filters.minDiscountPercent !== undefined &&
        result.discountPercent < filters.minDiscountPercent
      ) return false;
      if (
        filters.maxDistanceKm !== undefined &&
        result.distanceKm !== null &&
        result.distanceKm > filters.maxDistanceKm
      ) return false;
      if (
        search &&
        !`${listing.name} ${vendor.name} ${listing.area} ${listing.description}`
          .toLocaleLowerCase()
          .includes(search)
      ) return false;
      return true;
    });

  if (filters.sort === "discount") {
    listings.sort((a, b) => b.result.discountPercent - a.result.discountPercent);
  } else if (filters.sort === "distance" && origin) {
    listings.sort(
      (a, b) =>
        (a.result.distanceKm ?? Number.MAX_SAFE_INTEGER) -
        (b.result.distanceKm ?? Number.MAX_SAFE_INTEGER),
    );
  } else {
    listings.sort(
      (a, b) => a.listing.expiresAt.getTime() - b.listing.expiresAt.getTime(),
    );
  }

  res.json(listings.map(({ result }) => result));
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

router.post("/listings", requireUser, async (req, res) => {
  const input = CreateListingBody.parse(req.body);
  if (input.price >= input.originalPrice) {
    throw new HttpError(400, "The discounted price must be lower than the regular price.");
  }
  if (input.expiresAt <= new Date()) {
    throw new HttpError(400, "The pickup deadline must be in the future.");
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
  const consumerUserId = userId(res);
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

router.get("/vendors/following", requireUser, async (_req, res) => {
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
    .where(eq(vendorFollowsTable.consumerUserId, userId(res)))
    .orderBy(desc(vendorFollowsTable.createdAt));
  res.json(followed);
});

router.put("/vendors/:vendorId/follow", requireUser, async (req, res) => {
  const vendorId = String(req.params.vendorId);
  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, vendorId))
    .limit(1);
  if (!vendor) throw new HttpError(404, "Shop not found.");
  const currentUserId = userId(res);
  if (vendor.ownerUserId === currentUserId) {
    throw new HttpError(400, "You cannot follow your own shop.");
  }
  const [follow] = await db
    .insert(vendorFollowsTable)
    .values({ consumerUserId: currentUserId, vendorId })
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
        eq(vendorFollowsTable.vendorId, vendorId),
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
  await db
    .delete(vendorFollowsTable)
    .where(
      and(
        eq(vendorFollowsTable.consumerUserId, userId(res)),
        eq(vendorFollowsTable.vendorId, String(req.params.vendorId)),
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

export default router;
