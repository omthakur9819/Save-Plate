# 🍽️ Save Plate (Surplus Food Rescue Marketplace)

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-orange.svg)](https://pnpm.io/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-black.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.86-blue.svg)](https://reactnative.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_/_Supabase-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Save Plate** is a surplus food rescue marketplace platform that connects consumers with local bakeries, cafes, grocery stores, and restaurants. It enables merchants to sell surplus, near-expiry, or end-of-day food items at discounted prices, drastically reducing food waste while providing affordable meals to the community.

---

## 🌟 Key Features

### 🛒 Consumer Marketplace
- **Surplus Discovery Feed:** Browse available surprise bags and surplus dishes with real-time stock counters, discounted pricing, and remaining pickup windows.
- **Dietary & Category Filters:** Quickly filter by categories (*Bakery*, *Meals*, *Produce*, *Dairy*, *Desserts*) and dietary tags (*Vegetarian*, *Vegan*, *Halal*, *Gluten-Free*).
- **Interactive Map:** Locate nearby partner food stores and bakeries with real-time distance calculations and map pins.
- **Contactless QR Pickup:** Instant in-app QR code generation for quick counter validation and pickup confirmation.
- **Order Tracking:** Real-time order state updates from `RESERVED` to `PICKED_UP`.

### 🏪 Merchant / Vendor Portal
- **Rapid Surplus Listing:** Merchants can create listings within seconds by specifying quantity, original price, discounted rescue price, pickup time window, and dietary tags.
- **Inventory & Status Management:** Active/inactive toggles, automatic inventory countdown on checkout, and expiry tracking.
- **Pickup Verification:** Verify customer pickups directly via order codes or QR scanning.

---

## 🏗️ Architecture & Tech Stack

This project is organized as a **pnpm monorepo** with shared packages for type-safety and contract-first API development:

```
Save Plate 2.0/
├── artifacts/
│   ├── food-rescue-marketplace/  # Frontend: Expo (React Native) Web & Mobile app
│   ├── api-server/               # Backend: Express 5 API with TypeScript & esbuild
│   └── mockup-sandbox/           # UI prototypes & design components
├── lib/
│   ├── db/                       # Drizzle ORM schema, Postgres client & migrations
│   ├── api-spec/                 # OpenAPI specification & Orval client generator
│   ├── api-zod/                  # Shared Zod validation schemas
│   └── api-client-react/         # Auto-generated React Query API client
├── supabase/
│   ├── migrations/               # Supabase SQL initialization migrations
│   └── seed.sql                  # Seed data for mock vendors and listings
└── run-local.ps1                 # One-click Windows PowerShell local launch script
```

### Technologies

| Layer | Technologies |
|---|---|
| **Mobile & Web App** | React Native, Expo SDK 57, Expo Router, NativeWind (Tailwind CSS), Zustand, Gorhom Bottom Sheet, Reanimated |
| **Backend API** | Node.js, Express 5, TypeScript, Pino Logger, esbuild |
| **Database & ORM** | PostgreSQL, Drizzle ORM, Supabase (Auth, Storage, Postgres) |
| **API Contracts** | OpenAPI 3.0, Zod, Orval (Code generation) |
| **Authentication** | Supabase Auth / Clerk |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v20+ or v22 LTS recommended)
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** instance (local Docker, Postgres service, or [Supabase](https://supabase.com))

---

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/omthakur9819/Save-Plate.git
cd Save-Plate
pnpm install
```

---

### 2. Configure Environment Variables

Create `.env` inside `artifacts/api-server/` based on `artifacts/api-server/.env.example`:

```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:root@localhost:5433/surplus_saver
SESSION_SECRET=your-random-32-character-secret
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Supabase (for Expo Frontend & Storage)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

---

### 3. Database Setup & Seed

Push the Drizzle database schema:

```bash
# Push schema to PostgreSQL
pnpm --filter @workspace/db run push
```

*(Optional)* If using Supabase directly, apply the migration and seed data:
```bash
# Located in supabase/migrations/ and supabase/seed.sql
```

---

### 4. Running the Project

#### Option A: Quick Start (Windows PowerShell)
Run the automated launcher script to start both the API server and the Expo app:

```powershell
.\run-local.ps1
```

#### Option B: Manual Start

**Terminal 1 — API Server:**
```bash
cd artifacts/api-server
pnpm run dev
# Starts on http://localhost:5000
```

**Terminal 2 — Expo Frontend (Web / iOS / Android):**
```bash
cd artifacts/food-rescue-marketplace
pnpm exec expo start --web --port 8081
```

- Open `http://localhost:8081` in your browser for the Web preview.
- Press `a` for Android Emulator or `i` for iOS Simulator.
- Scan the Metro QR code using the **Expo Go** mobile app.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `pnpm run typecheck` | Run TypeScript type checks across all workspace packages |
| `pnpm run build` | Build all artifacts and packages |
| `pnpm --filter @workspace/api-server run dev` | Start backend API server in dev mode |
| `pnpm --filter @workspace/db run push` | Push schema changes directly to Postgres |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client hooks and schemas from OpenAPI spec |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m "Add some AmazingFeature"`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
