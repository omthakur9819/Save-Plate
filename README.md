# 🍽️ Save Plate 2.0 (Surplus Saver)

[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK_57-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-PostGIS-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Save Plate** is a surplus food rescue marketplace connecting conscious consumers with local bakeries, cafes, and restaurants. Rescue delicious food at **50%–70% off**, reduce food waste, and support local businesses.

---

## 🌟 Key Features

- **🥐 Surplus Food Feed & Mystery Bags**  
  Browse daily fresh surplus batches categorized into **Bakery**, **Cafe**, and **Meals**. View real-time stock levels, original vs. rescue prices (in ₹ INR), and countdown timers for pickup windows.
- **🗺️ Interactive Map & Geolocation Discovery**  
  Locate participating food vendors nearby with real-time distance calculations powered by PostGIS coordinates.
- **🔄 Dual Buyer & Seller Experience**  
  Switch seamlessly between:
  - **Rescue Mode (Consumer):** Discover deals, reserve items, and track saved money & CO₂ reduction.
  - **Merchant Mode (Vendor):** Publish surplus listings in under 60 seconds, configure pickup windows, and manage quantities.
- **🎟️ Contactless QR Pickup Verification**  
  Instant digital reservation slips with generated QR codes (`react-native-qrcode-svg`) for quick in-store redemption.
- **🌱 Sustainability & Impact Tracker**  
  Track your personal and community milestones: meals rescued, rupees saved, and carbon footprint diverted from landfills.
- **📱 Universal Cross-Platform App**  
  Built with Expo Router and NativeWind for smooth performance on **Web**, **iOS**, and **Android**.

---

## 🏗️ Monorepo Architecture

This project is organized as a high-performance **pnpm monorepo**:

```text
Save Plate 2.0/
├── artifacts/
│   ├── food-rescue-marketplace/    # Expo SDK 57 + React Native mobile/web app
│   │   ├── app/                    # Expo file-based router pages & tabs
│   │   │   ├── (tabs)/             # Explore, Map, Orders, and Merchant Sell screens
│   │   │   └── listing/[id].tsx    # Detailed surplus listing view & checkout
│   │   ├── components/             # Reusable UI components (ListingCard, NearbyMap, etc.)
│   │   ├── context/                # Marketplace state & mode switcher
│   │   ├── lib/                    # Supabase client & storage adapters
│   │   └── store/                  # Zustand state management
│   │
│   ├── api-server/                 # Node.js + Express 5 backend API server
│   │   ├── src/                    # API routes, middlewares, & controllers
│   │   └── build.mjs               # esbuild bundle pipeline
│   │
│   └── mockup-sandbox/             # Design sandboxes & mock prototypes
│
├── lib/
│   ├── api-client-react/           # Generated React Query hooks (via Orval)
│   ├── api-spec/                   # OpenAPI v3 contracts & codegen specifications
│   ├── api-zod/                    # Zod schemas for input validation
│   └── db/                         # Drizzle ORM schema definitions & queries
│
├── supabase/
│   ├── migrations/                 # PostgreSQL migrations (PostGIS, tables, RLS)
│   └── seed.sql                    # Seed data (Mumbai culinary spots: Bandra, BKC, etc.)
│
├── run-local.ps1                   # One-click startup script for Windows (PowerShell)
├── pnpm-workspace.yaml             # Workspace definitions
└── package.json                    # Root monorepo scripts & configurations
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Mobile & Web Frontend** | [Expo (SDK 57)](https://expo.dev), [React Native 0.86](https://reactnative.dev), [React 19](https://react.dev), [Expo Router](https://docs.expo.dev/router/introduction/) |
| **Styling & UI** | [NativeWind (Tailwind CSS v3)](https://www.nativewind.dev/), [Lucide / Feather / SF Symbols](https://icons.expo.fyi/) |
| **State & Data Fetching** | [Zustand](https://zustand-demo.pmnd.rs/), [TanStack React Query](https://tanstack.com/query) |
| **Backend API** | [Node.js](https://nodejs.org/), [Express 5](https://expressjs.com/), [TypeScript 5.9](https://www.typescriptlang.org/) |
| **Database & Spatial** | [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) extension |
| **BaaS & Auth** | [Supabase](https://supabase.com/) & [Clerk](https://clerk.com/) |
| **Tooling & Monorepo** | [pnpm Workspaces](https://pnpm.io/workspaces), [Drizzle ORM](https://orm.drizzle.team/), [Orval](https://orval.dev/), [esbuild](https://esbuild.github.io/) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v20.x or v24.x ([Download Node.js](https://nodejs.org/))
- **pnpm** v9+ (`npm install -g pnpm`)
- **Git**

---

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/omthakur9819/Save-Plate.git
cd Save-Plate

# Install all workspace dependencies
pnpm install
```

> **Note on Build Scripts:** If pnpm prompts about build approvals, run:
> ```bash
> pnpm approve-builds
> ```

---

### 2. Environment Configuration

Copy the sample environment variables for the API server:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
```

Default local environment values:

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:root@localhost:5433/surplus_saver
SESSION_SECRET=local-development-secret-key-32chars
CLERK_PUBLISHABLE_KEY=pk_test_sample
CLERK_SECRET_KEY=sk_test_sample
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon-key
```

---

### 3. Running the Application

#### Option A: One-Click Startup (Windows PowerShell)

Run the included automated helper script:

```powershell
.\run-local.ps1
```

This launches the Express API server and runs the Expo Web application on `http://localhost:8081`.

---

#### Option B: Running Manually in Separate Terminals

**Terminal 1 — API Server:**

```bash
cd "artifacts/api-server"
node ./build.mjs
node --env-file=.env --enable-source-maps ./dist/index.mjs
```
*(Runs on `http://localhost:5000`)*

**Terminal 2 — Frontend Application (Expo):**

```bash
cd "artifacts/food-rescue-marketplace"
pnpm exec expo start 
```

- Open **Web**: Press `w` or visit `http://localhost:8081` in your browser.
- Open **Android**: Press `a` (requires Android Emulator or Expo Go).
- Open **iOS**: Press `i` (requires macOS & Xcode Simulator).
- Open on **Physical Phone**: Scan the QR code shown in the terminal using the **Expo Go** app.

---

## 🗄️ Database Setup & Seed Data

The project includes pre-configured database migrations and real-world seed data for Mumbai spots (Theobroma, Subko Specialty Coffee, Bombay Canteen, Punjab Grill, etc.).

1. **Apply Migrations:**
   Run the schema script located at:
   ```text
   supabase/migrations/20261008000000_init_surplus_saver.sql
   ```
2. **Apply Mumbai Seed Data:**
   Load the sample vendors, surplus listings, and initial inventory:
   ```text
   supabase/seed.sql
   ```

---

## 💻 Available Scripts

| Command | Description |
|---|---|
| `pnpm run typecheck` | Run TypeScript verification across all workspace packages |
| `pnpm run build` | Typecheck and build all workspace projects |
| `pnpm --filter @workspace/food-rescue-marketplace run dev` | Start the Expo development server |
| `pnpm --filter @workspace/api-server run build` | Build the Express API server with esbuild |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks and Zod schemas from OpenAPI specs |
| `pnpm --filter @workspace/db run push` | Synchronize Drizzle schema with the active PostgreSQL database |

---

## 🤝 Contributing

Contributions to make food rescue more accessible and impactful are welcome!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
