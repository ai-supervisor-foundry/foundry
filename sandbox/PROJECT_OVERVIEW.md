# EaseClassifieds - Sandbox Overview

## Repositories
- **Frontend:** sandbox/easeclassifieds (React + TypeScript + Tailwind + Vite)
- **Backend:** sandbox/easeclassifieds-api (NestJS + TypeScript + PostgreSQL + Redis)

## Key Features (shared product)
- Phone-based authentication with OTP and JWT sessions
- Subscription tiers with daily curated feed limits
- Smart search with filters for properties and vehicles
- Listings management with images and favorites/bookmarks
- Accessible, mobile-first UX

## Runtime & Ports
- Frontend dev server: 3000 (Vite, proxy `/api` → http://localhost:3002/api)
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

## State & Notes
- Backend rate limiting for OTP: 1/min, 5/hour, 10/day per number; IP limits also apply (configurable in .env)
- Phone auth required for most features
- Use LocalStack/S3 per backend README for storage in dev
- For testing across both apps, run backend first (3002) then frontend (3000)
