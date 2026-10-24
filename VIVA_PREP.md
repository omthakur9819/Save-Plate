# Save Plate 2.0 (Surplus Saver) — Comprehensive Viva Preparation Guide

---

## 1. Project Summary

### Written Summary (180 words)
**Save Plate 2.0 (Surplus Saver)** is a hyper-local surplus food rescue marketplace built for urban India (specifically tailored and seeded for Mumbai). Commercial bakeries, cafes, and restaurants regularly produce high-quality, fresh unsold food that is discarded at closing time due to limited shelf life, while cost-conscious urban consumers seek affordable meals. Save Plate connects these two groups through an end-to-end platform comprising a cross-platform mobile application (Expo / React Native) and a high-performance RESTful API server (Express 5, TypeScript, Drizzle ORM, and PostgreSQL with PostGIS). 

The platform allows food vendors to list surplus food at 40%–70% discounts during evening pickup windows. Consumers discover nearby offers via interactive Google Maps with live A* and OSRM pedestrian/vehicle routing, filter dishes by strict dietary and allergen preferences, chat with an AI food rescue assistant, and reserve portions using Razorpay or pay-at-counter options. The main innovations include an LLM-powered natural language query parser with bilingual Hinglish support, a deterministic rule checker that blocks allergen contradictions, and a tamper-proof HMAC-SHA256 digital signature pickup protocol.

### 30-Second Spoken Pitch (Say this at the start of your viva)
> *"Save Plate 2.0 is a hyper-local surplus food rescue marketplace connecting Mumbai cafes and bakeries with consumers to prevent fresh food from ending up in landfills. Built as a pnpm monorepo with an Expo React Native frontend and an Express 5 TypeScript backend on PostgreSQL, it solves urban food waste through three key technical pillars: real-time geospatial discovery using PostGIS and Google Maps routing, safe dietary auto-tagging with deterministic allergen contradiction blocking, and an AI-powered conversational search assistant capable of understanding Mumbai slang and Hinglish queries."*

---

## 2. Architecture Overview

### Monorepo Architecture Diagram
```
+---------------------------------------------------------------------------------------+
|                                    SAVE PLATE 2.0                                     |
|                               (pnpm Workspaces Monorepo)                              |
+---------------------------------------------------------------------------------------+
                                           |
     +-------------------------------------+------------------------------------+
     |                                                                          |
[Mobile / Web Client]                                                  [Backend API Server]
artifacts/food-rescue-marketplace                                      artifacts/api-server
- Expo 58 / React Native 0.88                                          - Node.js 24 + Express 5.2
- Expo Router v58 (File-based navigation)                              - TypeScript + esbuild
- NativeWind (Tailwind CSS v3)                                         - @clerk/express (Auth Middleware)
- Zustand 5 (Global filter/location store)                             - Pino HTTP Structured Logging
- MarketplaceContext (AsyncStorage cache)                              - Rate Limiting (In-Memory sliding window)
- GoogleMapsWebView (Cross-platform maps)                              - Google Gemini 2.0 Flash / OpenAI
- aStarRouting.ts (A* + OSRM routing)                                  - Expo Push Notification Dispatcher
     |                                                                          |
     +-------------------> Shared Workspace Libraries <------------------------+
     |                     (lib/ in root directory)                             |
     |  +---------------------+-------------------+---------------------+       |
     |  |   lib/api-spec      |   lib/api-zod     |   lib/db            |       |
     |  |   OpenAPI 3.0 YAML  |   Zod Validation  |   Drizzle ORM       |       |
     |  |   Orval code-gen    |   Runtime Schemas |   PostgreSQL Schema |       |
     |  +---------------------+-------------------+---------------------+       |
     |                                                                          |
     | REST API Calls (HTTP :5000)                                              | Drizzle Pool / pg
     +------------------------------------------------------------------------->|
                                                                                v
                                                                   [PostgreSQL Database]
                                                                   (Local / Supabase)
                                                                   - PostGIS extension
                                                                   - Tables: marketplace_*
                                                                   - Coordinates: micro-degrees
```

### End-to-End Request Flow: Reserving a Listing

When a consumer taps **"Reserve & Pay"** on a listing:
1. **User Action & UI**: In [app/listing/[id].tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx), the consumer selects quantity and payment method. If online, [components/RazorpayDemoModal.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/RazorpayDemoModal.tsx) simulates the checkout.
2. **Context Dispatch**: `placeOrder(listing, quantity, paymentMethod, paymentId)` in [context/MarketplaceContext.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx) executes.
3. **HTTP Request**: The client sends a `POST /api/orders` request with `{ listingId, quantity }` validated against `CreateOrderBody` from [lib/api-zod](file:///g:/clg/Save%20Plate%202.0/lib/api-zod/src/index.ts).
4. **Authentication**: [middlewares/requireUser.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/middlewares/requireUser.ts) inspects the Clerk session token via `getAuth(req).userId`. If valid, it ensures the user exists in `marketplace_users`.
5. **Database Transaction & Concurrency Lock**: In [routes/marketplace.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts), an explicit `db.transaction()` executes:
   - `SELECT * FROM marketplace_listings WHERE id = ... FOR UPDATE`: Locks the listing row to prevent race conditions.
   - Validates that `quantity >= requestedQuantity` and `expiresAt > NOW()`.
   - `UPDATE marketplace_listings SET quantity = quantity - requestedQuantity`.
   - `INSERT INTO marketplace_orders`: Records reservation status as `RESERVED`.
6. **HMAC Signature Generation**: The backend executes `createHmac("sha256", SESSION_SECRET).update(`${order.id}:${consumerUserId}:${vendorId}`).digest("hex")`.
7. **Push Notification**: [lib/push.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/push.ts) asynchronously queries `marketplace_push_devices` for the vendor and dispatches an Expo push notification.
8. **Response**: Returns the order JSON containing `pickupQrPayload` with the HMAC signature to the client.

---

## 3. Tech Stack: Component-by-Component

| Technology | What it is | Why used in this project & File Path | Alternative not chosen & Why | Likely Viva Question |
| :--- | :--- | :--- | :--- | :--- |
| **Expo 58** | React Native application framework & toolchain | Fast cross-platform builds for iOS, Android, and Web with native module management. ([artifacts/food-rescue-marketplace/package.json](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/package.json#L29)) | Bare React Native CLI: Rejected because Expo manages native upgrades, splash screens, assets, and builds without manual Xcode/Gradle link errors. | *"Why Expo instead of vanilla React Native?"* |
| **React Native 0.88** | Framework for compiling React to native mobile UI | Renders true native primitives (`UIView`, `android.view.View`) rather than web views for fluid 60fps animations. ([artifacts/food-rescue-marketplace/package.json](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/package.json#L48)) | Flutter: Rejected because code reuse with TypeScript web libraries and shared validation schemas was required. | *"How does React Native communicate with the native platform?"* |
| **Expo Router v58** | File-based typed routing library | Organizes navigation using filesystem directories (`app/(tabs)/index.tsx`, `app/listing/[id].tsx`) with deep linking. ([artifacts/food-rescue-marketplace/app/_layout.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/_layout.tsx#L14)) | React Navigation stack boilerplates: Rejected because file-based routing matches Next.js conventions and eliminates manual route wiring. | *"How do dynamic parameters work in Expo Router?"* |
| **React 19** | Core UI library | Powers concurrent rendering, fast reconciliation, and modern hooks. ([artifacts/food-rescue-marketplace/package.json](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/package.json#L46)) | React 18: Adopted to align with Expo 58's default toolchain and React Compiler support. | *"What are the benefits of React 19 in mobile apps?"* |
| **NativeWind v4** | Tailwind CSS compiler for React Native | Allows utility-first styling with unified responsive design across iOS, Android, and Web. ([artifacts/food-rescue-marketplace/global.css](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/global.css)) | `StyleSheet.create` alone: Writing raw stylesheet objects for every component increases boilerplate and slows UI development. | *"How does NativeWind translate web CSS classes to native styles?"* |
| **Zustand 5** | Lightweight client state management | Manages non-persisted client search filters, category selections, and GPS user location without context re-render thrashing. ([artifacts/food-rescue-marketplace/store/useAppStore.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/store/useAppStore.ts#L42)) | Redux Toolkit: Rejected because Redux requires heavy actions, reducers, and dispatchers for simple UI filter toggles. | *"Why use Zustand if you already have React Context?"* |
| **TanStack React Query** | Server-state caching and synchronization | Handles background data fetching, cache invalidation, and request deduplication. ([artifacts/food-rescue-marketplace/app/_layout.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/_layout.tsx#L2)) | Raw `fetch` inside `useEffect`: Causes waterfall re-renders, lack of caching, and unhandled memory leaks on unmount. | *"What problem does React Query solve that useEffect does not?"* |
| **Node.js 24 + Express 5** | JavaScript runtime and HTTP web framework | Express 5 offers native `async/await` error propagation without manual `try/catch` wrappers. ([artifacts/api-server/src/app.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/app.ts#L1)) | Fastify / NestJS: Express 5 was chosen for simplicity, mature middleware ecosystem, and standard HTTP middleware support. | *"What is the main improvement of Express 5 over Express 4?"* |
| **TypeScript 5.9** | Statically typed superset of JavaScript | Enforces strict end-to-end type contracts across database schemas, API routes, and mobile UI screens. ([tsconfig.base.json](file:///g:/clg/Save%20Plate%202.0/tsconfig.base.json)) | Plain JavaScript: Avoided because runtime `undefined` errors in marketplace transactions could corrupt financial inventory. | *"How does TypeScript improve monorepo safety?"* |
| **PostgreSQL 16** | Relational SQL database | ACID compliance, row-level locking (`FOR UPDATE`), and JSONB support for order state and listings. ([lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts)) | MongoDB: NoSQL document stores lack ACID transactional locks needed to prevent two users reserving the last food item simultaneously. | *"Why is ACID compliance critical for a surplus marketplace?"* |
| **PostGIS** | Spatial database extender for PostgreSQL | Provides geospatial functions, geographic coordinate calculations, and spatial indices. ([supabase/migrations/20261008000000_init_surplus_saver.sql](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L4)) | Client-side distance sorting: Pulling all city listings to the client to calculate distance wastes bandwidth and battery. | *"How does PostGIS calculate distance between two coordinates?"* |
| **Supabase** | Backend-as-a-Service on top of PostgreSQL | Houses PostgreSQL migrations, PostGIS stored procedures, and storage adapter. ([artifacts/food-rescue-marketplace/lib/supabase.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/lib/supabase.ts#L33)) | Firebase Firestore: Lacks SQL joins, relational integrity, and native PostGIS geospatial index functions. | *"Are you using Supabase Auth or Supabase Postgres?"* |
| **Clerk** | Authentication & user identity platform | Handles JWT verification, user identity, and session tokens via `@clerk/express`. ([artifacts/api-server/src/middlewares/requireUser.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/middlewares/requireUser.ts#L1)) | Self-hosted passport.js with bcrypt: High maintenance, requires building password resets, MFA, and OAuth security from scratch. | *"Where is Clerk executed in your request lifecycle?"* |
| **Drizzle ORM** | TypeScript Object-Relational Mapper | SQL-like query builder with zero runtime overhead, instant startup, and automatic type inference. ([lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts)) | Prisma: Prisma runs a heavy Rust query engine binary that increases cold starts and lacks direct control over SQL lock clauses. | *"Why Drizzle ORM over Prisma?"* |
| **Zod** | Schema declaration and data validation | Validates incoming API payloads at runtime and automatically infers TypeScript types. ([lib/api-zod/src/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/api-zod/src/index.ts#L1)) | Joi / Yup: Zod integrates directly with TypeScript type inference (`z.infer<T>`) without duplicate interface declarations. | *"How does Zod bridge compile-time types with runtime validation?"* |
| **OpenAPI 3.0 + Orval** | API contract and client code generator | Single source of truth in `openapi.yaml` automatically generates typed React Query hooks and Zod schemas. ([lib/api-spec/openapi.yaml](file:///g:/clg/Save%20Plate%202.0/lib/api-spec/openapi.yaml)) | Manual API client authoring: Prone to frontend-backend contract drift when backend routes change. | *"What is API contract-first development?"* |
| **pnpm Workspaces** | Monorepo package manager | Fast, symlink-based dependency sharing between mobile app, API server, and shared libraries without duplicate installs. ([pnpm-workspace.yaml](file:///g:/clg/Save%20Plate%202.0/pnpm-workspace.yaml)) | npm / yarn v1: npm duplicates megabytes of node_modules per workspace, causing out-of-memory errors on dev machines. | *"How does pnpm save disk space across monorepo packages?"* |
| **esbuild** | High-speed JavaScript/TypeScript bundler | Bundles the Express API into optimized single-file outputs in milliseconds. ([artifacts/api-server/build.mjs](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/build.mjs)) | tsc / Webpack: Webpack takes 15–30 seconds to compile, while esbuild completes in under 200ms. | *"Why use esbuild for backend bundling instead of tsc?"* |
| **react-native-webview** | Native WebView component | Renders interactive Google Maps with route polylines inside Expo Go without requiring native iOS SDK linking. ([components/GoogleMapsWebView.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/GoogleMapsWebView.tsx#L13)) | Native Google Maps SDK: Not bundled in iOS Expo Go by default due to binary size limits. | *"How did you get Google Maps working on iOS inside Expo Go?"* |
| **Pino & pino-http** | High-performance JSON logger | Extremely low-overhead structured logging for Express requests with redaction support. ([artifacts/api-server/src/lib/logger.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/logger.ts)) | `console.log`: Blocks the single-threaded Node.js event loop when printing heavy objects under load. | *"Why structured logging instead of console.log?"* |

---

## 4. Implemented Features vs. Planned Scope

### Implemented Features (Verified in Code)

#### 1. Real-Time Surplus Food Discovery & Feed
- **What it does**: Displays active surplus food items from Mumbai bakeries, cafes, and restaurants with price, % discount, pickup time window, and dietary tags.
- **How it works in code**: [app/(tabs)/index.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/index.tsx) reads from [context/MarketplaceContext.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx), which maintains 34 rich Mumbai listings across 10 top vendors. Filters by category (`Bakery`, `Cafe`, `Meals`), max price, and dietary tags (`Vegetarian`, `Vegan`, `Egg-Free`, `Jain`, `Halal`).
- **Data flow**: Local state in `MarketplaceContext` initializes from `AsyncStorage` (`@saveplate_marketplace_state_v4`). On the API server, `GET /api/listings` in [routes/marketplace.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts) queries `marketplace_listings` using `filter-query-builder.ts`.
- **Limitations**: In offline/demo mode, listings are persisted in client storage and updated locally.

#### 2. Interactive Google Maps & A* / OSRM Route Estimation
- **What it does**: Visualizes nearby food spots on an interactive Google Map, plots walking/driving directions, and shows real-time distance and ETA.
- **How it works in code**: [components/NearbyMap.native.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/NearbyMap.native.tsx) renders [components/GoogleMapsWebView.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/GoogleMapsWebView.tsx) via `react-native-webview`. [lib/aStarRouting.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/lib/aStarRouting.ts) calculates ETA using the Haversine formula, A* road heuristics, and live OSRM network directions across 3 modes: `driving`, `two_wheeler`, and `walking`.
- **Data flow**: [app/(tabs)/map.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/map.tsx) accepts `spotlight` and `routeTo` params from dish pages to automatically focus the map and calculate the route.
- **Limitations**: Fallback routing uses Haversine Great Circle math when external OSRM servers are throttled or offline.

#### 3. AI Natural Language Search & Hinglish Parser
- **What it does**: Translates unstructured search queries like *"sasta veg khana near Bandra under 150"* into structured SQL/JSON filters.
- **How it works in code**: [artifacts/api-server/src/routes/search.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/search.ts) exposes `POST /api/search/parse`. Calls [lib/llm-search-parser.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-search-parser.ts). If an LLM key (`GEMINI_API_KEY` or `LLM_API_KEY`) is present, it prompts Google Gemini 2.0 Flash (`gemini-2.0-flash`, temperature: 0.1). If absent or on timeout, it executes `heuristicExtract()` using regex, Mumbai locality fuzzy resolution ([lib/mumbai-areas.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/mumbai-areas.ts)), and Hinglish vocabulary mapping (`meetha`, `kadak chai`, `nashta`, `sasta`).
- **Data flow**: Input string $\rightarrow$ Rate limiter (30 req/min) $\rightarrow$ Cache check (10 min TTL) $\rightarrow$ LLM or Heuristic $\rightarrow$ Zod validation $\rightarrow$ Structured filter response.
- **Limitations**: Rate-limited per IP/User to prevent abuse.

#### 4. SaveBot AI Food Rescue Chat Assistant
- **What it does**: Slide-up conversational chat sheet in the mobile app where users ask for food recommendations, budget deals, and dietary inquiries.
- **How it works in code**: [components/AIChatSheet.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/AIChatSheet.tsx) renders the UI. Sends chat history and live listings to `POST /api/search/chat` ([lib/llm-chat-assistant.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-chat-assistant.ts)). Matches dishes strictly against user budget and dietary rules, returning conversational text and matched listing cards.
- **Data flow**: If 0 listings match, it returns an empty `listingIds: []` array with a *"🔍 0 surplus listings found"* indicator rather than hallucinating or recommending irrelevant food.

#### 5. Allergen Auto-Tagging & Contradiction Checking
- **What it does**: Scans listing titles and descriptions to suggest 10 allergens and 5 dietary tags, and prevents impossible claims (e.g. marking paneer as vegan).
- **How it works in code**: [lib/llm-allergen-suggester.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-allergen-suggester.ts) and [lib/allergen-rule-checker.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/allergen-rule-checker.ts). Contains dictionary of Mumbai ingredients (paneer, mawa, khoya, shengdana, anda, baida, etc.). `checkContradictions()` blocks submission with HTTP 400 if a contradiction exists.
- **Safety Rule**: [routes/marketplace.ts:L256](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L256) strictly mandates `allergenInfoConfirmed: true` signed off by the vendor.

#### 6. Order Reservation & Razorpay Payment Simulation
- **What it does**: Allows consumers to reserve bags with online payment simulation or pay-at-counter option.
- **How it works in code**: [app/listing/[id].tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx) triggers [components/RazorpayDemoModal.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/RazorpayDemoModal.tsx) (UPI, Card, Netbanking test flows). Updates [app/(tabs)/orders.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/orders.tsx) with payment status badges.
- **Backend Flow**: In [routes/marketplace.ts:L359](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L359), orders are created inside a database transaction with `FOR UPDATE` lock.

#### 7. Vendor Portal & Listing Management
- **What it does**: Vendors switch to "Vendor Mode" via [app/(tabs)/sell.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/sell.tsx) to post surplus offers, set pickup windows, pick location on map, and review sales analytics.
- **Analytics**: `GET /api/vendor/analytics` calculates rescued food portions, confirmed revenue, customer savings, top items, and peak order hours.

#### 8. Cryptographic QR Verification Engine (Backend)
- **What it does**: Generates tamper-proof HMAC-SHA256 signatures for orders to prevent forgery during counter pickup.
- **How it works in code**: In [routes/marketplace.ts:L131](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L131), `pickupSignature(order)` hashes `order.id + ':' + consumerUserId + ':' + vendorId` with `SESSION_SECRET`. `POST /api/orders/verify-pickup` validates using `crypto.timingSafeEqual()`.

---

### Planned / Not Implemented List (Be Honest in Viva!)

1. **Dynamic / Automated Surge & Decay Pricing**:
   - *Status*: **Not implemented**. Prices are statically entered by vendors (`originalPrice` and discounted `price`). An algorithm that automatically decays prices as expiry approaches is planned for future iterations.
2. **ML Collaborative-Filtering Recommendation Engine**:
   - *Status*: **Not implemented**. The app does not have user-embedding recommendation models. Food discovery uses distance ranking, category filtering, and conversational AI search.
3. **Camera QR Scanning in the Frontend App**:
   - *Status*: **Partially implemented**. The cryptographic HMAC generator and backend verification endpoint are complete in `api-server`, and `react-native-qrcode-svg` is in `package.json`. However, the current mobile screen ([app/(tabs)/orders.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/orders.tsx)) renders a 5-character alphanumeric pickup code (`order.id.slice(-5)`) with a manual confirmation button instead of opening the camera scanner.
4. **Live Razorpay Production Gateway**:
   - *Status*: **Simulated**. Real banking transactions require merchant KYC, RBI compliance, and Razorpay live keys; the app implements an interactive demo modal that mirrors the full checkout UX.
5. **Full Clerk SDK Mobile Component Tree**:
   - *Status*: **Decoupled**. `@clerk/express` protects the API server routes with JWT session verification, while the mobile client features instant demo profile switching (`DEMO_SHOPPER`, `DEMO_VENDORS`) for offline examiner evaluation.

---

## 5. Database Design

### Table-by-Table Explanation

Save Plate uses a relational PostgreSQL schema defined via Drizzle ORM in [lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts) and backed by Supabase migrations in [supabase/migrations/](file:///g:/clg/Save%20Plate%202.0/supabase/migrations):

```
+--------------------------------------------------------------------------------------------------+
|                                    ENTITY RELATIONSHIP (ER) MAP                                  |
+--------------------------------------------------------------------------------------------------+

   [marketplace_users]
         | 1
         |
         +-----------------------+------------------------+
         | 1                     | 1                      | 1
         v                       v                        v
   [marketplace_vendors]   [marketplace_orders]     [marketplace_push_devices]
         | 1                     ^
         |                       | 1:N
         +-----------+           +------------------------+
         | 1         |                                    |
         v           v                                    v
   [marketplace_listings]                           [marketplace_messages]
         |
         | (1:N)
         v
   [marketplace_vendor_follows]
```

1. **`marketplace_users`**:
   - `id` (TEXT, PK): Clerk User ID (e.g., `user_2...`).
   - `created_at` (TIMESTAMPTZ): User registration timestamp.
2. **`marketplace_vendors`**:
   - `id` (UUID, PK, default random): Unique shop identifier.
   - `owner_user_id` (TEXT, FK $\rightarrow$ `marketplace_users.id`): Vendor manager.
   - `name` (TEXT), `city` (TEXT, default 'Mumbai'), `area` (TEXT).
   - `latitude_e6` / `longitude_e6` (INTEGER): Micro-degrees (degrees $\times 10^6$) for integer precision coordinate storage.
   - `created_at` (TIMESTAMPTZ).
3. **`marketplace_listings`**:
   - `id` (UUID, PK): Unique offer ID.
   - `vendor_id` (UUID, FK $\rightarrow$ `marketplace_vendors.id` ON DELETE CASCADE).
   - `name` (TEXT), `description` (TEXT), `category` (TEXT: `Bakery`, `Cafe`, `Meals`).
   - `price_inr` (INTEGER), `original_price_inr` (INTEGER).
   - `quantity` (INTEGER): Available bag inventory.
   - `pickup_window` (TEXT), `area` (TEXT).
   - `latitude_e6`, `longitude_e6` (INTEGER).
   - `dietary_tags`, `diet_tags`, `allergens`, `may_contain` (TEXT[]): Tag arrays.
   - `allergen_info_confirmed` (BOOLEAN): Safety gate flag.
   - `allergen_confirmed_at` (TIMESTAMPTZ), `allergen_confirmed_by` (TEXT).
   - `ai_suggestion` (JSONB): Raw AI suggestions for audit tracking.
   - `expires_at` (TIMESTAMPTZ), `active` (BOOLEAN).
4. **`marketplace_orders`**:
   - `id` (UUID, PK): Unique pickup reservation ID.
   - `listing_id` (UUID, FK $\rightarrow$ `marketplace_listings.id` ON DELETE RESTRICT).
   - `vendor_id` (UUID, FK $\rightarrow$ `marketplace_vendors.id`).
   - `consumer_user_id` (TEXT, FK $\rightarrow$ `marketplace_users.id`).
   - `quantity` (INTEGER), `unit_price_inr` (INTEGER), `total_price_inr` (INTEGER).
   - `status` (TEXT: `RESERVED`, `PREPARING`, `READY`, `PICKED_UP`, `CANCELLED`).
   - `created_at` (TIMESTAMPTZ), `picked_up_at` (TIMESTAMPTZ).
5. **`marketplace_vendor_follows`**:
   - Composite PK (`consumer_user_id`, `vendor_id`): Tracks which shops a consumer follows for push alerts.
6. **`marketplace_push_devices`**:
   - `token` (TEXT, PK): Expo push notification token.
   - `user_id` (TEXT, FK $\rightarrow$ `marketplace_users.id`).
   - `platform` (TEXT: `ios`, `android`, `web`).
7. **`marketplace_messages`**:
   - `id` (UUID, PK), `order_id` (UUID, FK), `sender_user_id` (TEXT), `body` (TEXT).

### PostGIS & Geospatial Design
- **Micro-degrees Storage**: In `marketplace_listings` and `marketplace_vendors`, coordinates are stored as integers multiplied by $10^6$ (`latitude_e6`, `longitude_e6`), avoiding floating-point rounding errors.
- **PostGIS Function**: In [supabase/migrations/20261008000000_init_surplus_saver.sql](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L109), the stored function `get_nearby_listings(user_lat, user_lng, max_radius_km)` executes the Great-Circle Haversine equation over spherical coordinates:
  $$\text{distance} = 6371 \times \arccos(\sin(\phi_1)\sin(\phi_2) + \cos(\phi_1)\cos(\phi_2)\cos(\Delta\lambda))$$
- **Seed Data**: Pre-seeded with authentic Mumbai spots in [supabase/seed.sql](file:///g:/clg/Save%20Plate%202.0/supabase/seed.sql):
  - *Theobroma Patisserie* (Bandra West, 19.0596, 72.8295)
  - *Subko Specialty Coffee & Bakehouse* (Ranwar Village, Bandra, 19.0543, 72.8288)
  - *The Bombay Canteen Express* (Lower Parel, 18.9953, 72.8315)
  - *Punjab Grill Kitchen* (BKC, 19.0657, 72.8687)

---

## 6. API Design: Endpoints Reference Table

All routes are mounted under `/api` in [artifacts/api-server/src/routes/](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes).

| Method | Path | Purpose | Request Body / Params | Response Shape | Auth Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health check | None | `{ status: "ok" }` | No |
| `GET` | `/api/me` | Current authenticated user ID | None | `{ id: string }` | Yes (`requireUser`) |
| `GET` | `/api/listings` | Search & filter active surplus listings | Query: `q`, `category`, `dietary`, `areas`, `maxPrice`, `minDiscountPercent`, `maxDistanceKm`, `latitude`, `longitude`, `sort` | `Listing[]` | No |
| `GET` | `/api/vendor/listings` | Fetch vendor's own listings | None | `Listing[]` | Yes (`requireUser`) |
| `POST` | `/api/listings` | Publish new surplus food listing | `CreateListingBody` (name, prices, quantity, allergenInfoConfirmed, etc.) | `Listing` (201 Created) | Yes (`requireUser`) |
| `POST` | `/api/listings/suggest-tags`| AI/Rule-based allergen & diet tag suggestions | `SuggestListingTagsBody` (`title`, `description`, `imageUrl`) | `{ dietary: Tag[], allergens: Tag[], mayContain: Tag[], aiAvailable: boolean }` | Yes (`requireUser`) |
| `GET` | `/api/orders` | Fetch consumer's order history | None | `(Order & { pickupQrPayload: string })[]` | Yes (`requireUser`) |
| `POST` | `/api/orders` | Reserve a surplus food listing (with DB lock) | `CreateOrderBody` (`listingId`, `quantity`) | `Order & { pickupQrPayload: string }` (201) | Yes (`requireUser`) |
| `GET` | `/api/vendor/orders` | Fetch orders placed at vendor's shop | None | `Order[]` | Yes (`requireUser`) |
| `PATCH`| `/api/orders/:orderId/status` | Advance order status (`PREPARING` $\rightarrow$ `READY`) | `OrderStatusBody` (`status`) | `Order` | Yes (`requireUser`) |
| `POST` | `/api/orders/verify-pickup` | Verify HMAC QR signature & complete pickup | `VerifyPickupBody` (`qrPayload`) | `Order` (status: `PICKED_UP`) | Yes (`requireUser`) |
| `GET` | `/api/vendors/following` | List vendors followed by consumer | None | `FollowedVendor[]` | Yes (`requireUser`) |
| `PUT` | `/api/vendors/:vendorId/follow` | Follow a vendor for push notifications | URL param `vendorId` | `FollowedVendor` | Yes (`requireUser`) |
| `DELETE`| `/api/vendors/:vendorId/follow` | Unfollow a vendor | URL param `vendorId` | 204 No Content | Yes (`requireUser`) |
| `GET` | `/api/vendor/analytics` | Vendor sales & impact analytics | Query: `period` (`week` \| `month`) | `{ rescuedPortions, confirmedRevenueInr, customerSavingsInr, topItems, peakOrderHours }` | Yes (`requireUser`) |
| `GET` | `/api/orders/:orderId/messages`| Fetch chat messages for an order | URL param `orderId` | `Message[]` | Yes (`requireUser`) |
| `POST` | `/api/orders/:orderId/messages`| Send a message between consumer & vendor | `SendMessageBody` (`body`) | `Message` (201 Created) | Yes (`requireUser`) |
| `POST` | `/api/push-devices` | Register an Expo push token | `PushDeviceBody` (`token`, `platform`) | 204 No Content | Yes (`requireUser`) |
| `DELETE`| `/api/push-devices` | Deregister an Expo push token | `PushDeviceBody` (`token`) | 204 No Content | Yes (`requireUser`) |
| `POST` | `/api/search/parse` | Natural language search query parser | `SearchParseInput` (`query`, `now`, `timezone`) | `SearchFiltersOutput` | No (Rate-limited: 30/min) |
| `POST` | `/api/search/chat` | AI Rescue Assistant chat completion | `ChatRequestSchema` (`messages`, `listings`, `userArea`) | `{ reply: string, listingIds: string[] }` | No (Rate-limited: 20/min) |

---

## 7. Security and Data Handling

1. **Authentication & Session Tokens**:
   - Backend relies on Clerk JWT verification through `@clerk/express` middleware in [artifacts/api-server/src/app.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/app.ts#L41).
   - [middlewares/requireUser.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/middlewares/requireUser.ts) rejects unauthenticated requests with HTTP 401.
2. **Authorization & Access Control**:
   - Vendors cannot reserve their own offers: checked in [routes/marketplace.ts:L383](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L383).
   - Order chat access is restricted: `userCanReadOrder()` verifies that the requester is either the consumer or the vendor owner; otherwise returns HTTP 403.
   - Only the vendor who received an order can verify its pickup QR code: checked in `routes/marketplace.ts:L500`.
3. **Cryptographic Signatures Against Fraud**:
   - The pickup QR code payload is signed using HMAC-SHA256 (`SESSION_SECRET`).
   - Verified via `crypto.timingSafeEqual()` to mitigate side-channel timing attacks.
4. **Input Validation**:
   - Every single API body and query parameter is strictly parsed using Zod schemas from [lib/api-zod](file:///g:/clg/Save%20Plate%202.0/lib/api-zod/src/index.ts). Malformed types or excess fields are rejected with HTTP 400 before hitting the database.
5. **Rate Limiting & DoS Protection**:
   - In-memory sliding-window rate limiters protect AI endpoints: 30 requests/min on `/api/search/parse` and 20 requests/min on `/api/search/chat`.
6. **Honest Security Weaknesses**:
   - *In-Memory Rate Limiter*: The rate limit cache lives in Node.js process memory. If the API is scaled horizontally across multiple instances without Redis, the rate limit resets per instance.
   - *Direct Database Role*: The API server connects to PostgreSQL via connection string pooling, bypassing Supabase Row Level Security (RLS). Authorization logic is enforced in the Express application layer.

---

## 8. AI/ML Components

### Models and Providers
- **Primary LLM**: Google Gemini 2.0 Flash (`gemini-2.0-flash` configured in [artifacts/api-server/.env](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/.env)) via direct REST endpoint (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`), with fallback to `gemini-1.5-flash`.
- **Alternative LLM**: OpenAI (`gpt-4o-mini`) via `/v1/chat/completions` with JSON mode.
- **Provider Switch**: Driven by environment variables `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY` in [artifacts/api-server/.env](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/.env).

### Prompts & Guardrails
- **Search Parser Prompt** ([lib/llm-search-parser.ts:L54](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-search-parser.ts#L54)):
  - Instructs the model to output strict JSON conforming to `SearchFiltersOutput`.
  - Injects current timestamp and timezone (`Asia/Kolkata`) so relative phrases (*"tonight"*, *"after 8 PM"*) resolve to absolute ISO timestamps.
  - Strict Rule: Never invent coordinates; map Mumbai localities to canonical area strings.
- **Allergen Suggester Prompt** ([lib/llm-allergen-suggester.ts:L61](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-allergen-suggester.ts#L61)):
  - **High-Recall Safety Mandate**: Severe allergic reactions can be fatal. If an item commonly contains an allergen (e.g. butter in croissants), it MUST be flagged.
  - Photos provide weak evidence; never assume an item is allergen-free based on appearance alone.

### Fallback Behavior (Offline / No API Key)
- If `LLM_API_KEY` is not provided or the LLM request times out (>6s):
  - **Natural Search Fallback**: `heuristicExtract()` in `llm-search-parser.ts` uses regex patterns, Mumbai locality fuzzy matcher (`mumbai-areas.ts`), and Hinglish dictionaries to parse the query locally with 100% schema compliance.
  - **Allergen Fallback**: `scanDietary()` and `scanAllergens()` in `allergen-rule-checker.ts` run keyword matching against a curated dictionary of Indian/Western dishes.

### Evaluation Suite
- **27-Query Benchmark**: In [artifacts/api-server/tests/search-parser.test.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/tests/search-parser.test.ts), 27 complex test queries (budget, dietary, Hinglish, multi-area) are evaluated across 24 unit tests, verifying that tests pass without throwing errors.

---

## 9. Testing, Deployment, and How to Run

### Automated Test Suite
- Run in `artifacts/api-server` via `pnpm test`:
  ```bash
  cd artifacts/api-server
  pnpm test
  ```
  - **24 Unit Tests across 8 test suites** (100% passing):
    - Mumbai Area Fuzzy Resolution
    - Safe Fallback and Heuristics
    - Rate Limiting
    - LLM Mocking & Error Resilience
    - 27-Query Evaluation Suite
    - Enhanced Search Heuristics (INR ₹ parsing, Hinglish vocabulary)
    - AI Rescue Chat Assistant (budget ceilings, non-veg isolation)

### How to Run Locally (`run-local.ps1`)
Save Plate includes a PowerShell automation script [run-local.ps1](file:///g:/clg/Save%20Plate%202.0/run-local.ps1):
```powershell
# 1. Launches API server in background with environment variables:
#    PORT=5000, DATABASE_URL, SESSION_SECRET, CLERK keys
# 2. Starts Expo Metro bundler:
cd 'artifacts/food-rescue-marketplace'
pnpm exec expo start --web --port 8081
```

### Environment Variables
| Variable | Used In | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | `api-server`, `lib/db` | PostgreSQL connection string (`postgresql://postgres:...@localhost:5433/...`) |
| `SESSION_SECRET` | `api-server` | Secret key for signing HMAC-SHA256 pickup QR payloads |
| `CLERK_PUBLISHABLE_KEY` | `api-server` | Clerk client key for JWT auth |
| `CLERK_SECRET_KEY` | `api-server` | Clerk secret key for server-side token validation |
| `LLM_PROVIDER` | `api-server` | `gemini` or `openai` |
| `LLM_MODEL` | `api-server` | Model identifier (active in `.env`: `gemini-2.0-flash`, fallback: `gemini-1.5-flash`) |
| `LLM_API_KEY` | `api-server` | API key for Gemini / OpenAI |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile App | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile App | Supabase anonymous JWT key |

### Deployment Strategy
- **Frontend Mobile**: Built using EAS (Expo Application Services) into an Android `.apk` or iOS TestFlight build, or deployed as a static progressive web app via `expo export --platform web`.
- **Backend API**: Packaged via `esbuild` into a single standalone bundle (`dist/index.mjs`) and deployed to a containerized platform (Docker, Railway, Render, AWS ECS, or Google Cloud Run).
- **Database**: Hosted on Supabase (managed Postgres with PostGIS extension enabled).

---

## 10. Honest Limitations & Future Scope

| Area | Current Limitation | Concrete Future Improvement |
| :--- | :--- | :--- |
| **Pricing** | Static pricing set by vendor manually. | Implement an automated linear decay pricing engine based on shelf-life half-life: e.g., 40% off 3 hours before close, decaying to 70% off 30 minutes before close. |
| **Payment Gateway** | Interactive Razorpay simulation modal. | Hook up production Razorpay webhooks (`order.paid`, `payment.failed`) with UPI intent flows on mobile. |
| **QR Redemption** | Alphanumeric 5-char code in mobile UI. | Integrate `expo-camera` scanner in the vendor view to scan and decode the SVG QR code directly on camera stream. |
| **State Sync** | Client uses `AsyncStorage` cache with fire-and-forget sync. | Transition mobile client fully to TanStack Query hooks generated from `lib/api-client-react`. |
| **Offline Sync** | No automated conflict resolution if offline edits occur. | Implement CRDT (Conflict-free Replicated Data Types) or WatermelonDB for structured offline-first sync. |
| **Delivery** | Self-pickup only. | Integrate third-party micro-delivery APIs (Dunzo, Porter, or Shadowfax) for consumers unable to walk to the store. |

---

## 11. 30 Viva Questions & Model Answers

### Category 1: Basics & Problem Statement (4 Questions)

#### Q1. What is the core problem Save Plate 2.0 solves?
> **Answer**: Urban food establishments discard substantial amounts of fresh, safe food daily simply because it cannot be stored past closing time, while consumers struggle with rising food costs. Save Plate bridges this disconnect by creating a time-sensitive, hyper-local surplus marketplace where food is sold at steep discounts during designated evening pickup windows. This minimizes landfill waste, reduces business loss for restaurants, and provides affordable food to consumers.
> *Where in code*: [supabase/seed.sql:L50-L140](file:///g:/clg/Save%20Plate%202.0/supabase/seed.sql#L50-L140), [context/MarketplaceContext.tsx:L120-L400](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx#L120-L400).

#### Q2. Who are the primary stakeholders and user personas in your application?
> **Answer**: There are two primary stakeholders: the Consumer (Shopper) and the Food Vendor (Bakeries, Cafes, Quick-Service Restaurants). Consumers use the mobile app to browse discounted meals, filter by dietary requirements, and reserve pickup bags. Vendors use the vendor mode to list expiring batches within seconds, select pickup hours, verify counter collections via QR codes, and view sales impact analytics.
> *Where in code*: [app/(tabs)/sell.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/sell.tsx), [app/login.tsx:L31-L43](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/login.tsx#L31-L43).

#### Q3. Why did you tailor the application specifically for Mumbai?
> **Answer**: Hyper-local food rescue requires high restaurant density, heavy pedestrian footfall, and localized culinary terminology. Mumbai features distinct neighborhoods (Bandra, BKC, Lower Parel) with vibrant food cultures and specific local dietary patterns (Jain, Halal, Pure Veg). Tailoring the seed data, PostGIS boundaries, and Hinglish NLP dictionary to Mumbai demonstrates real-world viability rather than a generic mock application.
> *Where in code*: [artifacts/api-server/src/lib/mumbai-areas.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/mumbai-areas.ts), [supabase/seed.sql:L6-L48](file:///g:/clg/Save%20Plate%202.0/supabase/seed.sql#L6-L48).

#### Q4. How does Save Plate differ from commercial food delivery apps like Zomato or Swiggy?
> **Answer**: Zomato and Swiggy are on-demand delivery platforms optimized for made-to-order food delivered to doorsteps, which adds delivery fees and packaging costs. Save Plate focuses exclusively on scheduled counter pickup of existing surplus inventory at 50%–70% discounts. By eliminating delivery riders and packaging overhead, restaurants recover food costs while consumers access restaurant-quality food at street-food prices.
> *Where in code*: [app/listing/[id].tsx:L324-L342](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx#L324-L342).

---

### Category 2: Architecture & Design Decisions (6 Questions)

#### Q5. Why did you structure the repository as a pnpm monorepo?
> **Answer**: In a full-stack TypeScript application, sharing data schemas and API contracts between the frontend and backend is essential. Our monorepo structure allows `artifacts/api-server` and `artifacts/food-rescue-marketplace` to import shared Zod schemas (`lib/api-zod`) and database models (`lib/db`) directly. pnpm was chosen because its symlink-based content-addressable storage saves gigabytes of disk space and eliminates duplicate dependency installations across packages.
> *Where in code*: [pnpm-workspace.yaml](file:///g:/clg/Save%20Plate%202.0/pnpm-workspace.yaml), [package.json](file:///g:/clg/Save%20Plate%202.0/package.json).

#### Q6. What is the contract-first OpenAPI and Orval workflow in this project?
> **Answer**: Instead of writing backend routes and frontend fetchers independently, we define the API contract in [lib/api-spec/openapi.yaml](file:///g:/clg/Save%20Plate%202.0/lib/api-spec/openapi.yaml). Running Orval code-generation automatically parses this specification to produce runtime Zod validation schemas in `lib/api-zod` and typed TanStack Query React hooks in `lib/api-client-react`. This guarantees zero contract drift between frontend requests and backend validations.
> *Where in code*: [lib/api-spec/orval.config.ts](file:///g:/clg/Save%20Plate%202.0/lib/api-spec/orval.config.ts), [lib/api-zod/src/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/api-zod/src/index.ts).

#### Q7. [TRICKY] What happens if two consumers try to reserve the last surplus bag at the exact same millisecond?
> **Answer**: In [artifacts/api-server/src/routes/marketplace.ts:L362-L410](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L362-L410), the reservation runs inside an ACID database transaction utilizing PostgreSQL's `SELECT ... FOR UPDATE` clause. When the first request hits the database, it places an exclusive row-level lock on that listing row. The second concurrent request is queued until the first transaction completes, sees that `quantity` has decreased to 0, and is immediately aborted with an HTTP 409 Conflict error ("This offer no longer has enough portions available").
> *Where in code*: [artifacts/api-server/src/routes/marketplace.ts:L367-L376](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L367-L376).

#### Q8. Why did you choose Drizzle ORM over Prisma?
> **Answer**: Prisma operates via an external binary engine written in Rust, which adds cold-start latency and increases memory footprint in serverless environments. Drizzle ORM is a lightweight, zero-overhead TypeScript query builder that compiles directly to SQL strings. Furthermore, Drizzle allows precise SQL constructs like `.for("update")` and PostgreSQL micro-degree indexing that are awkward to implement in Prisma's schema abstraction.
> *Where in code*: [lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts), [artifacts/api-server/src/routes/marketplace.ts:L367](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L367).

#### Q9. How is offline or low-connectivity handled on the mobile device?
> **Answer**: Mobile network connections can be spotty in urban basements or food counters. In [artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx), the application utilizes an offline-first state machine backed by `AsyncStorage`. All listing updates, created offers, and order tickets are instantly updated in local memory and persisted to device disk, with asynchronous background sync to Supabase. This guarantees that consumers can always display their active pickup tickets even without cellular reception.
> *Where in code*: [context/MarketplaceContext.tsx:L1380-L1465](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx#L1380-L1465).

#### Q10. [TRICKY] How is the pickup QR code verified cryptographically to prevent customer forgery?
> **Answer**: Rather than encoding raw order IDs in the QR code which anyone could forge, the backend generates an HMAC-SHA256 digital signature: `HMAC(orderId + ':' + consumerUserId + ':' + vendorId, SESSION_SECRET)`. When scanned at the counter, `POST /api/orders/verify-pickup` recalculates the expected signature and compares them using `crypto.timingSafeEqual()`. This ensures the ticket is cryptographically valid, belongs to the scanning vendor, and prevents replay attacks or timing analysis.
> *Where in code*: [artifacts/api-server/src/routes/marketplace.ts:L131-L142](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L131-L142), [routes/marketplace.ts:L476-L520](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L476-L520).

---

### Category 3: Tech Stack Specifics (6 Questions)

#### Q11. How does Google Maps render in your mobile app on iOS inside Expo Go?
> **Answer**: In standard Expo Go on iOS, native Google Maps (`react-native-maps` with `PROVIDER_GOOGLE`) is not bundled to minimize binary size, defaulting to Apple Maps (MapKit). To provide true Google Maps across both platforms, we built [components/GoogleMapsWebView.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/GoogleMapsWebView.tsx), which embeds Google Maps inside `react-native-webview`. This enables interactive map markers, GPS positioning, and direction routes seamlessly across iOS and Android Expo Go.
> *Where in code*: [components/NearbyMap.native.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/NearbyMap.native.tsx), [components/GoogleMapsWebView.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/GoogleMapsWebView.tsx).

#### Q12. What role does Zustand play compared to React Context in your application?
> **Answer**: React Context triggers re-renders across all consuming components whenever any value in the context object changes. We use `MarketplaceContext` strictly for data that changes infrequently (such as listings and order collections). For high-frequency interactive UI states—such as slider price ceilings, category chips, active text query, and GPS coordinates—we use Zustand in [store/useAppStore.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/store/useAppStore.ts) to achieve selective component re-rendering without performance drops.
> *Where in code*: [artifacts/food-rescue-marketplace/store/useAppStore.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/store/useAppStore.ts).

#### Q13. How are push notifications handled for vendor listing alerts?
> **Answer**: Consumers who follow specific vendors have records in `marketplace_vendor_follows`. When a vendor posts a new listing, [artifacts/api-server/src/lib/push.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/push.ts) queries all follower device tokens from `marketplace_push_devices` and batches them into HTTP requests sent to the Expo Push Service (`https://exp.host/--/api/v2/push/send`). If Expo returns an unregistered device error, the stale token is automatically purged from the database.
> *Where in code*: [artifacts/api-server/src/lib/push.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/push.ts), [routes/marketplace.ts:L330-L340](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L330-L340).

#### Q14. Why are coordinates stored as integers (`latitude_e6`, `longitude_e6`) instead of floating-point numbers?
> **Answer**: Standard IEEE 754 floating-point numbers are subject to binary rounding discrepancies when transferred between database drivers, JSON serialization, and different operating systems. Storing coordinates as micro-degrees ($19.059600 \times 10^6 = 19059600$) guarantees exact millimeter precision, enables compact B-tree indexing in PostgreSQL, and prevents subtle floating-point drift during geospatial comparison.
> *Where in code*: [lib/db/src/schema/index.ts:L30-L31](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts#L30-L31), [artifacts/api-server/src/routes/marketplace.ts:L47-L50](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L47-L50).

#### Q15. How does your Express 5 backend handle unhandled promise rejections?
> **Answer**: In Express 4, asynchronous route handlers that threw errors without an explicit `catch(next)` block would cause unhandled promise rejections that could crash the Node.js process. Express 5 natively intercepts rejected promises from `async` route handlers and forwards them automatically to the global 4-parameter error middleware in [artifacts/api-server/src/app.ts:L51-L63](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/app.ts#L51-L63), formatting them cleanly into structured JSON responses.
> *Where in code*: [artifacts/api-server/src/app.ts:L51-L63](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/app.ts#L51-L63).

#### Q16. What is the role of `build.mjs` and `esbuild` in the API server?
> **Answer**: In [artifacts/api-server/build.mjs](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/build.mjs), `esbuild` compiles TypeScript source files, bundles monorepo workspace dependencies, and generates source maps in less than 200 milliseconds. It bundles Pino logging plugins with `esbuild-plugin-pino` and produces executable ESM bundles (`dist/index.mjs`) ready for production container deployment without requiring a TypeScript compiler at runtime.
> *Where in code*: [artifacts/api-server/build.mjs](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/build.mjs).

---

### Category 4: Database, PostGIS & API (5 Questions)

#### Q17. How does the PostGIS stored procedure `get_nearby_listings` work?
> **Answer**: The function accepts `user_lat`, `user_lng`, and `max_radius_km`. It calculates distance using the spherical law of cosines on the Earth's radius (6371 km), converts degree coordinates to radians, joins the `listings` table with `vendors`, filters out inactive or expired listings, and returns the records ordered by ascending distance in kilometers.
> *Where in code*: [supabase/migrations/20261008000000_init_surplus_saver.sql:L109-L165](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L109-L165).

#### Q18. How does `filter-query-builder.ts` implement multi-attribute search in SQL?
> **Answer**: In [artifacts/api-server/src/lib/filter-query-builder.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/filter-query-builder.ts), the builder dynamically constructs Drizzle SQL expressions. It combines conditions using `and()` clauses: case-insensitive `ilike` pattern matching for keywords, category matching, array overlaps for dietary tags, price ceiling filters (`lte`), and dynamic Haversine distance computations when user coordinates are provided.
> *Where in code*: [artifacts/api-server/src/lib/filter-query-builder.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/filter-query-builder.ts).

#### Q19. What indexes exist in your database schema to optimize queries?
> **Answer**: In [lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts), we defined composite and single-column indexes:
> 1. `marketplace_listings_active_expiry_idx` on `(active, expiresAt)` to quickly filter available listings.
> 2. `marketplace_listings_vendor_idx` on `(vendorId, createdAt)` for vendor history.
> 3. `marketplace_orders_consumer_idx` on `(consumerUserId, createdAt DESC)` for instant customer ticket loading.
> 4. `marketplace_vendors_city_idx` on `city` for city-level filtering.
> *Where in code*: [lib/db/src/schema/index.ts:L36, L86-L88, L117](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts#L36).

#### Q20. What is Row Level Security (RLS) in your Supabase migration, and how is it applied?
> **Answer**: In [supabase/migrations/20261008000000_init_surplus_saver.sql:L170-L180](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L170-L180), RLS is enabled across all tables. Policies like `"Public read active listings"` allow anonymous reads on active listings while protecting internal vendor profiles. When using the Express API with direct connection pooling, application-level authorization in `requireUser` takes precedence, but RLS protects direct client connections through Supabase PostgREST.
> *Where in code*: [supabase/migrations/20261008000000_init_surplus_saver.sql:L170-L180](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L170-L180).

#### Q21. How does the vendor analytics endpoint calculate metrics without third-party analytics tools?
> **Answer**: In [artifacts/api-server/src/routes/marketplace.ts:L598-L666](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L598-L666), `GET /api/vendor/analytics` aggregates completed orders (`status = 'PICKED_UP'`) across a 7-day or 30-day window. It calculates total rescued portions, revenue, customer savings (`originalPrice - unitPrice`), identifies the top 5 rescued items via hash mapping, and computes hourly histograms adjusted for Indian Standard Time (`Asia/Kolkata`).
> *Where in code*: [artifacts/api-server/src/routes/marketplace.ts:L598-L666](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L598-L666).

---

### Category 5: Code Walkthrough & Features (4 Questions)

#### Q22. Show me where a customer opens directions from a food dish page.
> **Answer**: In [artifacts/food-rescue-marketplace/app/listing/[id].tsx:L330-L375](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx#L330-L375), the location row and "Explore in App Map" button trigger a navigation push to `/(tabs)/map` passing `spotlight: listing.id` and `routeTo: listing.id`. Alternatively, the "Open Google Maps" button calls `Linking.openURL()` with the vendor's GPS coordinates (`https://www.google.com/maps/search/?api=1&query=lat,lng`) to launch turn-by-turn navigation in the external Google Maps app.
> *Where in code*: [artifacts/food-rescue-marketplace/app/listing/[id].tsx:L330-L375](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx#L330-L375).

#### Q23. Where is the A* routing algorithm implemented and how does it calculate ETAs?
> **Answer**: In [artifacts/food-rescue-marketplace/lib/aStarRouting.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/lib/aStarRouting.ts), the function `getRouteEstimate(start, end, mode)` attempts to fetch real road-network polylines from the public OSRM API. If unreachable, it falls back to a local heuristic calculating Haversine distance adjusted by an urban winding factor (1.35x for Mumbai traffic), returning transit speeds: 35 km/h for cars, 40 km/h for two-wheelers, and 4.8 km/h for walking.
> *Where in code*: [artifacts/food-rescue-marketplace/lib/aStarRouting.ts:L140-L260](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/lib/aStarRouting.ts#L140-L260).

#### Q24. Show me where a vendor creates a surplus offer and sets allergen safety tags.
> **Answer**: In [artifacts/food-rescue-marketplace/app/(tabs)/sell.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/sell.tsx), the vendor inputs dish name, pricing, category, and quantity. The vendor can tap "Suggest tags" to call `POST /api/listings/suggest-tags`, toggle allergens and diet badges, and MUST confirm the allergen acknowledgment switch before the submit button unlocks.
> *Where in code*: [artifacts/food-rescue-marketplace/app/(tabs)/sell.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/sell.tsx), [context/MarketplaceContext.tsx:L1426-L1467](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/context/MarketplaceContext.tsx#L1426-L1467).

#### Q25. Where is the Razorpay checkout simulation executed in code?
> **Answer**: In [components/RazorpayDemoModal.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/RazorpayDemoModal.tsx), an interactive modal replicates the Razorpay modal interface. It allows the examiner to test realistic UPI apps (Google Pay, PhonePe, Paytm), Card entry with auto-formatting, and simulates a 1.2-second bank authorization delay before generating a mock `pay_...` transaction ID that is passed into `placeOrder()`.
> *Where in code*: [components/RazorpayDemoModal.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/RazorpayDemoModal.tsx), [app/listing/[id].tsx:L465-L510](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx#L465-L510).

---

### Category 6: AI Features, Safety & Ethics (3 Questions)

#### Q26. [TRICKY] What happens if the AI model mistakenly classifies an egg dish as vegan or egg-free?
> **Answer**: To prevent life-threatening allergic reactions, we enforce a strict **Defense-in-Depth** safety architecture. AI suggestions are treated as non-authoritative recommendations. In [artifacts/api-server/src/lib/allergen-rule-checker.ts:L31-L87](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/allergen-rule-checker.ts#L31-L87), deterministic keyword rules scan for terms like *egg*, *anda*, and *baida*. If an egg term is detected while marked *vegan* or *egg-free*, `checkContradictions()` flags a blocking contradiction. Furthermore, the API server strictly rejects any listing creation unless `allergenInfoConfirmed: true` is explicitly submitted by the human vendor.
> *Where in code*: [artifacts/api-server/src/lib/allergen-rule-checker.ts:L25-L30](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/allergen-rule-checker.ts#L25-L30), [routes/marketplace.ts:L256-L272](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/routes/marketplace.ts#L256-L272).

#### Q27. How does your search assistant handle colloquial Indian terms and Hinglish?
> **Answer**: In [artifacts/api-server/src/lib/llm-search-parser.ts:L160-L320](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-search-parser.ts#L160-L320) and [mumbai-areas.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/mumbai-areas.ts), we implemented a specialized heuristic parser. It recognizes terms like *sasta* (cheap $\rightarrow$ sort by price), *badi chhoot* (heavy discount $\rightarrow \ge 50\%$), *meetha/mithai* (sweets $\rightarrow$ dessert), *kadak chai* (tea), *nashta* (breakfast/snacks), and *shakahari* (pure vegetarian). It also resolves phonetic variations of Mumbai areas (e.g., *Bandra W*, *Ranwar*, *Kamala Mills* $\rightarrow$ Lower Parel).
> *Where in code*: [artifacts/api-server/src/lib/llm-search-parser.ts:L289-L320](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-search-parser.ts#L289-L320).

#### Q28. How does SaveBot ensure it does not hallucinate dishes when no surplus food matches the user's prompt?
> **Answer**: In [artifacts/api-server/src/lib/llm-chat-assistant.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-chat-assistant.ts) and [components/AIChatSheet.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/AIChatSheet.tsx), Rule 4 explicitly prohibits hallucinating food items. The assistant is passed the actual live listing inventory. If zero items meet the criteria (for example, asking for sweets at a seafood restaurant), the engine returns `listingIds: []` and displays an explicit badge: `🔍 0 surplus listings found`, explaining politely that no matching surplus batches are available tonight.
> *Where in code*: [artifacts/api-server/src/lib/llm-chat-assistant.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/llm-chat-assistant.ts), [components/AIChatSheet.tsx:L735-L755](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/components/AIChatSheet.tsx#L735-L755).

---

### Category 7: Limitations & Scalability (2 Questions)

#### Q29. [TRICKY] How would you scale this architecture from 10 restaurants in Mumbai to 10,000 restaurants across India?
> **Answer**: Scaling to 10,000 vendors requires three architectural evolutions:
> 1. **Geospatial Sharding**: Partitioning the `marketplace_listings` table by city/region and applying PostGIS R-tree spatial indexing (`GIST(geom)`) to avoid full-table distance scans.
> 2. **Distributed Caching & Rate Limiting**: Replacing the in-memory Node.js query cache and sliding-window maps with an external Redis cluster for cross-instance rate limiting and session management.
> 3. **Event-Driven Messaging**: Replacing synchronous push notification loops with a distributed message broker (RabbitMQ or Apache Kafka) to dispatch high-volume push alerts asynchronously.
> *Where in code*: [artifacts/api-server/src/lib/push.ts](file:///g:/clg/Save%20Plate%202.0/artifacts/api-server/src/lib/push.ts), [supabase/migrations/20261008000000_init_surplus_saver.sql:L42, L65](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql#L42).

#### Q30. Why does the app support counter pickup instead of doorstep delivery?
> **Answer**: Delivery introduces high minimum order sizes, delivery partner commissions (20%–30%), and transit delays that often exceed the tight shelf-life windows of surplus food. Furthermore, transporting single bakery bags via motorbikes creates additional carbon emissions that negate the environmental benefits of saving food. Walking to pick up food at a neighborhood counter maintains high affordability, eliminates transit packaging, and encourages community-level environmental action.
> *Where in code*: [app/listing/[id].tsx:L324-L342](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/listing/%5Bid%5D.tsx#L324-L342).

---

## 12. Quick Revision Sheet (One-Page Cheat Sheet)

### The Tech Stack in One Line Each
- **Expo 58 / React Native 0.88**: Mobile toolchain compiling typed React to native iOS/Android screens.
- **Expo Router v58**: File-system-based typed navigation routing.
- **NativeWind v4**: Utility-first Tailwind CSS styling for native primitives.
- **Zustand 5**: Fast global store for active search filters, category chips, and GPS position.
- **TanStack React Query**: Server-state caching and asynchronous fetch synchronization.
- **Node.js 24 + Express 5**: Modern HTTP backend with native `async/await` error propagation.
- **TypeScript 5.9**: Monorepo-wide static type enforcement.
- **PostgreSQL 16 + PostGIS**: Relational database with spherical Haversine geospatial calculations.
- **Drizzle ORM**: Zero-runtime-overhead TypeScript SQL query builder.
- **Zod**: Runtime input validation inferring compile-time TypeScript types.
- **OpenAPI 3.0 + Orval**: Contract-first API specification generating typed client hooks and Zod schemas.
- **pnpm Workspaces**: Monorepo package manager using hardlinks to eliminate duplicate dependencies.
- **Google Gemini 2.0 Flash**: LLM powering natural language search and Hinglish translation (configured via `LLM_MODEL=gemini-2.0-flash` in `artifacts/api-server/.env`).
- **react-native-webview**: Renders cross-platform Google Maps with custom A* and OSRM routing.
- **HMAC-SHA256**: Cryptographic digital signing algorithm securing customer pickup tickets.

### The 5 Main Flows in One Line Each
1. **Browse & Reserve**: Consumer filters dishes on home feed $\rightarrow$ selects portion on details page $\rightarrow$ completes Razorpay demo payment $\rightarrow$ database transaction decrements inventory with `FOR UPDATE` lock.
2. **Vendor Post Offer**: Vendor enters surplus dish info in sell tab $\rightarrow$ picks location on Google Maps $\rightarrow$ AI suggests allergens $\rightarrow$ vendor confirms safety $\rightarrow$ push notification alerts followers.
3. **Pickup Verification**: Consumer shows ticket in Pickups tab $\rightarrow$ backend verifies HMAC-SHA256 signature using constant-time `timingSafeEqual()` $\rightarrow$ status updates to `PICKED_UP`.
4. **Login / Auth**: Mobile client provides instant 1-click demo profiles (Shopper / Vendor) $\rightarrow$ API server middleware validates Clerk JWT tokens and inserts user into `marketplace_users`.
5. **Map & Routing**: GPS coordinates captured via `expo-location` $\rightarrow$ Google Maps WebView renders interactive pins $\rightarrow$ A* and live OSRM engines calculate walking/driving route polylines and ETAs.

### Key Numbers to Remember
- **7 Monorepo Packages**: 2 applications (`artifacts/food-rescue-marketplace`, `artifacts/api-server`) + 1 sandbox + 4 shared libraries (`lib/db`, `lib/api-zod`, `lib/api-spec`, `lib/api-client-react`).
- **7 Database Tables**: `marketplace_users`, `marketplace_vendors`, `marketplace_listings`, `marketplace_orders`, `marketplace_vendor_follows`, `marketplace_push_devices`, `marketplace_messages`.
- **21 API Endpoints**: Mounted under `/api/` covering search, listings, orders, messages, analytics, and device tokens.
- **34 Mock Listings & 10 Vendors**: Seeded across Bandra West, BKC, Lower Parel, Juhu, Andheri, Colaba, Powai, Dadar, and Worli.
- **24 Unit Tests**: 100% passing test suite across 8 test suites in `artifacts/api-server`.
- **10 Allergen Categories**: Milk, egg, peanuts, tree nuts, gluten, soy, fish, shellfish, sesame, mustard.
- **5 Dietary Tags**: Vegetarian, Vegan, Egg-Free, Jain, Halal.

### 10 One-Line Answers to Most Likely Questions
1. *Why a monorepo?* To share Zod validation schemas and database models directly between client and server without code duplication.
2. *Why Drizzle over Prisma?* Drizzle has zero runtime overhead, faster execution, and supports native SQL row locks like `.for("update")`.
3. *How do you prevent double-reserving the last item?* Using an ACID transaction with a PostgreSQL `SELECT ... FOR UPDATE` row-level lock.
4. *How does the pickup QR code prevent fraud?* It is signed with HMAC-SHA256 using a server secret and verified via `crypto.timingSafeEqual()`.
5. *How did you get Google Maps on iOS in Expo Go?* By wrapping Google Maps in `react-native-webview` rather than relying on native Google Maps iOS SDKs.
6. *What happens if the LLM API is down?* The system falls back automatically to a local regex and rule-based heuristic with 100% schema compliance.
7. *How are allergen contradictions prevented?* A deterministic rule checker runs on every submission and blocks impossible claims (e.g. Vegan + paneer) with HTTP 400.
8. *What is PostGIS used for?* For geospatial distance calculations using the spherical Haversine formula on latitude and longitude coordinates.
9. *Why counter pickup instead of delivery?* Delivery fees and partner delays negate the savings and shelf-life urgency of surplus food rescue.
10. *Is dynamic pricing implemented?* No, vendors set prices manually; automated time-decay pricing is planned for future releases.

---

## 13. Things I Should Double-Check Before the Viva

> [!IMPORTANT]
> Keep these points in mind during the viva so you never contradict the actual codebase:

1. **Camera QR Scanning vs. Alphanumeric Code**:
   - The README mentions QR scanning with `react-native-qrcode-svg`. The backend HMAC signature and verification endpoints are fully written, but the current mobile UI ([app/(tabs)/orders.tsx](file:///g:/clg/Save%20Plate%202.0/artifacts/food-rescue-marketplace/app/%28tabs%29/orders.tsx)) renders a 5-character alphanumeric pickup code (`order.id.slice(-5)`) with a manual confirmation button. State this honestly if asked.
2. **Dynamic Pricing**:
   - Dynamic pricing is NOT automated in the code. Vendors enter `price` and `originalPrice` manually. Do not claim dynamic pricing is running.
3. **ML Recommendations**:
   - There is no collaborative filtering or ML recommender system. Food discovery uses PostGIS distance sorting, category/dietary filters, and conversational AI search (SaveBot).
4. **Clerk Authentication**:
   - The backend has full `@clerk/express` middleware and token proxying. The mobile app has `@clerk/expo` installed, but currently uses pre-configured 1-click demo profiles (`DEMO_SHOPPER`, `DEMO_VENDORS`) for offline examiner evaluation.
5. **Database Table Names**:
   - In Drizzle ORM ([lib/db/src/schema/index.ts](file:///g:/clg/Save%20Plate%202.0/lib/db/src/schema/index.ts)), tables are named `marketplace_listings`, `marketplace_vendors`, `marketplace_orders`, etc. In the initial Supabase migration ([supabase/migrations/20261008000000_init_surplus_saver.sql](file:///g:/clg/Save%20Plate%202.0/supabase/migrations/20261008000000_init_surplus_saver.sql)), tables were named `listings`, `vendors`, `orders`.
