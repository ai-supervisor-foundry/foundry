# EaseClassifieds - Sandbox Overview

## Repositories
- **Frontend (Web):** sandbox/easeclassifieds (React + TypeScript + Tailwind + Vite)
- **Backend:** sandbox/easeclassifieds-api (NestJS + TypeScript + PostgreSQL + Redis)
- **Mobile:** sandbox/easeclassifieds-mobile (React Native + Expo + TypeScript)

## Key Features (shared product)
- Phone-based authentication with OTP and JWT sessions
- Subscription tiers with daily curated feed limits
- Smart search with filters for properties and vehicles
- Listings management with images and favorites/bookmarks
- Accessible, mobile-first UX

## Runtime & Ports
- Frontend dev server (web): 3000 (Vite, proxy `/api` → http://localhost:3002/api)
- Mobile dev server: Expo Go (connects via tunnel to backend on 3002)
- Backend API: 3002 (NestJS global prefix `/api`)
- Database: PostgreSQL (default 5432)
- Cache: Redis/Dragonfly (default 6499)

## Backend (easeclassifieds-api)
- Tech: NestJS, TypeORM, PostgreSQL, Redis, JWT, phone OTP
- Modules: auth, listings, search, feed, subscription, favorites, storage, aggregation, mail, users, tenants
- Status: migrations run (44), core APIs (auth/listings/search/feed/subscription/favorites) working; payment integration and external aggregation pending; search filter enhancements pending
- Setup:
  ```bash
  cd sandbox/easeclassifieds-api
  pnpm install
  cp .env.example .env
  pnpm run migration:run
  pnpm run start:dev  # port 3002
  ```

## Frontend (easeclassifieds)
- Tech: React, TypeScript, Tailwind, Vite, Axios, React Router
- Features: phone auth UI, feed, search, categories, favorites, subscription/profile screens (some pending)
- API base: `/api` proxied to backend on 3002
- Setup:
  ```bash
  cd sandbox/easeclassifieds
  npm install
  npm run dev  # port 3000
  ```

## Mobile (easeclassifieds-mobile)
- Tech: React Native, Expo, TypeScript, React Navigation, NativeWind
- Status: Basic Expo shell created; 33 migration tasks defined; features pending
- Features planned: phone auth, feed, search, favorites, profile (view-only)
- API: Connects to same backend (3002) via Expo tunnel in dev
- Setup:
  ```bash
  cd sandbox/easeclassifieds-mobile
  npm install
  npm start  # or expo start --tunnel
  # Scan QR code with Expo Go app on iOS/Android device
  ```

## State & Notes
- Backend rate limiting for OTP: 1/min, 5/hour, 10/day per number; IP limits also apply (configurable in .env)
- Phone auth required for most features on web and mobile
- Use LocalStack/S3 per backend README for storage in dev
- Mobile app uses Expo Go for development (no native builds required)
- For testing: run backend first (3002), then web (3000) and/or mobile (expo start --tunnel)
