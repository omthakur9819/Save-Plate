import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const marketplaceUsersTable = pgTable("marketplace_users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vendorsTable = pgTable(
  "marketplace_vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: text("owner_user_id").references(() => marketplaceUsersTable.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    city: text("city").notNull().default("Mumbai"),
    area: text("area").notNull(),
    latitude: integer("latitude_e6"),
    longitude: integer("longitude_e6"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marketplace_vendors_owner_idx").on(table.ownerUserId),
    index("marketplace_vendors_city_idx").on(table.city),
  ],
);

export const listingsTable = pgTable(
  "marketplace_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    photo: text("photo").notNull().default("lunch"),
    price: integer("price_inr").notNull(),
    originalPrice: integer("original_price_inr").notNull(),
    quantity: integer("quantity").notNull(),
    pickupWindow: text("pickup_window").notNull(),
    area: text("area").notNull(),
    latitude: integer("latitude_e6"),
    longitude: integer("longitude_e6"),
    dietaryTags: text("dietary_tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    index("marketplace_listings_active_expiry_idx").on(table.active, table.expiresAt),
    index("marketplace_listings_vendor_idx").on(table.vendorId, table.createdAt),
  ],
);

export const ordersTable = pgTable(
  "marketplace_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listingsTable.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "restrict" }),
    consumerUserId: text("consumer_user_id")
      .notNull()
      .references(() => marketplaceUsersTable.id, { onDelete: "cascade" }),
    listingName: text("listing_name").notNull(),
    vendorName: text("vendor_name").notNull(),
    pickupArea: text("pickup_area").notNull(),
    pickupWindow: text("pickup_window").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price_inr").notNull(),
    originalUnitPrice: integer("original_unit_price_inr").notNull(),
    totalPrice: integer("total_price_inr").notNull(),
    status: text("status").notNull().default("RESERVED"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true }),
  },
  (table) => [
    index("marketplace_orders_consumer_idx").on(table.consumerUserId, table.createdAt),
    index("marketplace_orders_vendor_idx").on(table.vendorId, table.createdAt),
  ],
);

export const vendorFollowsTable = pgTable(
  "marketplace_vendor_follows",
  {
    consumerUserId: text("consumer_user_id")
      .notNull()
      .references(() => marketplaceUsersTable.id, { onDelete: "cascade" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendorsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.consumerUserId, table.vendorId] }),
    index("marketplace_vendor_follows_vendor_idx").on(table.vendorId),
  ],
);

export const pushDevicesTable = pgTable(
  "marketplace_push_devices",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => marketplaceUsersTable.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("marketplace_push_devices_user_idx").on(table.userId)],
);

export const messagesTable = pgTable(
  "marketplace_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    senderUserId: text("sender_user_id")
      .notNull()
      .references(() => marketplaceUsersTable.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("marketplace_messages_order_idx").on(table.orderId, table.createdAt)],
);

export const marketplaceUserRelations = relations(marketplaceUsersTable, ({ many }) => ({
  ownedVendors: many(vendorsTable),
  orders: many(ordersTable),
  follows: many(vendorFollowsTable),
  pushDevices: many(pushDevicesTable),
  messages: many(messagesTable),
}));

export type MarketplaceUser = typeof marketplaceUsersTable.$inferSelect;
export type Vendor = typeof vendorsTable.$inferSelect;
export type Listing = typeof listingsTable.$inferSelect;
export type MarketplaceOrder = typeof ordersTable.$inferSelect;
export type MarketplaceMessage = typeof messagesTable.$inferSelect;
