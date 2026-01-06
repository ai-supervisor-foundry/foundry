# EaseClassifieds - Project Overview

## Project Description

EaseClassifieds is a full-stack classifieds super app that aggregates property and vehicle listings. The system features a subscription-based daily curated feed system, phone authentication, and a clean, accessible mobile interface designed for senior-friendly usage.

## Core Vision

A modern classifieds platform that:
- Aggregates property and vehicle listings from multiple sources
- Provides a curated daily feed based on subscription tiers
- Uses phone-based authentication (no email required)
- Offers an accessible, mobile-first interface optimized for all users
- Supports smart search with natural language query parsing

## Project Architecture

### Repository Structure
- **Frontend (Web):** `sandbox/easeclassifieds/` - React + TypeScript + Tailwind CSS
- **Backend:** `sandbox/easeclassifieds-api/` - NestJS + TypeScript + PostgreSQL
- **Mobile:** `sandbox/easeclassifieds-mobile/` - React Native + Expo + TypeScript

### Technology Stack

**Frontend (Web):**
- React 18+ with Vite
- TypeScript
- Tailwind CSS
- React Router
- Axios for API communication

**Mobile:**
- React Native 0.81+ with Expo
- TypeScript
- React Navigation (native-stack, bottom-tabs)
- NativeWind (Tailwind for React Native)
- Axios for API communication
- Expo Go for development

**Backend:**
- NestJS framework
- TypeScript
- PostgreSQL (via TypeORM)
- Redis/DragonflyDB (caching and queues)
- JWT authentication
- Phone OTP verification

## Key Features

### 1. Phone Authentication
- Phone number-based authentication (no email required)
- OTP (One-Time Password) verification via SMS
- JWT token-based session management
- Rate limiting for security (1 req/min per number, 5 req/hour, 10 req/day)
- Token refresh mechanism

### 2. Subscription Tiers
- **Freemium:** 5 listings per day
- **Paid:** 10 listings per day
- **Premium:** 50 listings per day
- **Premium Plus:** 100 listings per day
- Daily feed limits reset automatically
- Tier upgrade flow with payment integration

### 3. Daily Curated Feed
- Algorithm-based curation (newest, verified listings, popular areas, user preferences)
- Feed metadata tracking (limit, remaining, reset time)
- Caching strategy for performance
- Daily reset mechanism
- Subscription tier-based feed limits

### 4. Smart Search
- Natural language query parsing
- Keyword extraction from search queries
- Filter extraction (category, price range, location, property/vehicle attributes)
- Support for property-specific filters (type, bedrooms, bathrooms, area)
- Support for vehicle-specific filters (make, model, year, fuel type, transmission)
- Structured filter generation from parsed queries

### 5. Listings Management
- Property listings (apartments, houses, plots, commercial)
- Vehicle listings (cars, motorcycles, trucks, etc.)
- CRUD operations for listings
- Image upload and processing
- Favorites/bookmarks functionality
- Listing aggregation from external sources (e.g., PakWheels)

### 6. Senior-Friendly UI/UX
- Large, readable fonts (minimum 16px)
- High contrast color scheme
- Clear navigation structure
- Mobile-responsive design
- Touch-friendly interactive elements
- WCAG 2.1 AA accessibility compliance
- Screen reader support

## Data Models

### Core Entities
- **Users:** Phone-based user accounts with subscription tiers
- **Listings:** Base entity with polymorphic inheritance
  - **Property Listings:** Apartments, houses, plots, commercial
  - **Vehicle Listings:** Cars, motorcycles, trucks, etc.
- **Subscriptions:** User subscription management with tiers
- **Favorites:** User bookmarked listings
- **OTP Codes:** Phone verification codes with expiration
- **Search History:** User search query tracking
- **Listing Sources:** External listing aggregation sources
- **Listing Price History:** Price tracking over time

### Key Enums
- **ListingCategory:** VEHICLES, PROPERTIES, etc.
- **ListingStatus:** ACTIVE, SOLD, DELETED, etc.
- **PropertyType:** APARTMENT, HOUSE, PLOT, COMMERCIAL, etc.
- **VehicleType:** SUV, SEDAN, TRUCK, MOTORCYCLE, COUPE, HATCHBACK, CONVERTIBLE, VAN, BUS
- **FuelType:** PETROL, DIESEL, ELECTRIC, HYBRID, etc.
- **UserTier:** FREE, BASIC, PREMIUM, PREMIUM_PLUS
- **OtpPurpose:** login, signup, password_reset, phone_verification

## API Endpoints

### Authentication
- `POST /api/auth/phone/request-otp` - Request OTP code
- `POST /api/auth/phone/verify-otp` - Verify OTP and get JWT
- `POST /api/auth/phone/resend-otp` - Resend OTP code
- `POST /api/auth/phone/refresh` - Refresh JWT token

### Listings
- `GET /api/listings` - Get all listings (with pagination and filters)
- `POST /api/listings` - Create new listing
- `GET /api/listings/:id` - Get listing by ID
- `PUT /api/listings/:id` - Update listing
- `DELETE /api/listings/:id` - Delete listing

### Search
- `GET /api/search` - Smart search with query parsing
- `POST /api/search` - Advanced search with filters

### Feed
- `GET /api/feed/daily` - Get daily curated feed (subscription-based)

### Subscriptions
- `GET /api/subscriptions` - Get user subscriptions
- `POST /api/subscriptions` - Create/upgrade subscription
- `PUT /api/subscriptions/:id` - Update subscription

### Favorites
- `GET /api/favorites` - Get user favorites
- `POST /api/favorites` - Add listing to favorites
- `DELETE /api/favorites/:id` - Remove from favorites

## Configuration

### Frontend
- **Dev Server:** Port 3000
- **API Proxy:** `/api` → `http://localhost:3002/api`
- **Environment:** Vite with TypeScript

### Backend
- **API Port:** 3002
- **API Prefix:** `/api`
- **Database:** PostgreSQL (port 5432)
- **Cache:** Redis/DragonflyDB (port 6499)

## Current Status

### Completed
- ✅ Project structure and architecture
- ✅ Frontend React setup with Tailwind CSS
- ✅ Backend NestJS setup with TypeORM
- ✅ Phone authentication (frontend and backend)
- ✅ Database migrations (44 migrations executed)
- ✅ API endpoints for listings, search, feed
- ✅ Subscription tier system
- ✅ Favorites functionality
- ✅ File storage and image processing
- ✅ All TypeScript compilation errors fixed
- ✅ All runtime issues resolved

### In Progress / Pending
- Mobile app migration (33 tasks defined, implementation pending)
- Listing aggregation from external sources
- Payment integration (Stripe/PayPal)
- Advanced search filters UI
- Profile management UI
- Subscription management UI

## Development Notes

### Rate Limiting
- OTP requests: 1/min, 5/hour, 10/day per phone number
- IP-based limits: 10/min, 50/hour per IP
- Important for testing: Wait 60 seconds between attempts or use different phone numbers

### Service Worker Cache
- Frontend may cache old code
- Solution: Unregister service workers, hard refresh browser

### Database Migrations
- All 44 migrations executed successfully
- Schema is up to date
- Tables created with proper relationships

### Circular Dependencies
- Resolved using `forwardRef()` in NestJS modules
- SubscriptionModule ↔ AuthModule
- SearchModule ↔ ListingsModule

## Project Goals

The primary goal is to create a full-stack classifieds platform that:
1. Aggregates property and vehicle listings from multiple sources
2. Provides a subscription-based curated daily feed
3. Uses phone authentication for easy access
4. Offers an accessible, mobile-first interface
5. Supports natural language search with intelligent filtering

## Target Users

- **Primary:** Users looking to buy/sell properties and vehicles
- **Special Focus:** Senior-friendly design for accessibility
- **Mobile Users:** Optimized for mobile-first experience

## Business Model

- **Freemium:** Free tier with 5 listings/day
- **Paid Tiers:** Subscription-based with increasing daily limits
- **Payment Integration:** Stripe and PayPal support

## External Integrations

- **Listing Aggregation:** PakWheels and other classifieds sources
- **SMS/OTP:** Phone verification service
- **Payment:** Stripe and PayPal
- **Storage:** AWS S3 (or LocalStack for local dev)
- **Email:** SendGrid (optional)

## Project Structure

```
sandbox/
├── easeclassifieds/          # Frontend Web (React + Tailwind)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API service layer
│   │   ├── types.ts           # TypeScript types
│   │   └── App.tsx            # Main app component
│   ├── vite.config.ts         # Vite config with proxy
│   └── package.json
│
├── easeclassifieds-mobile/    # Mobile (React Native + Expo)
│   ├── App.tsx                # Main app component
│   ├── app.json               # Expo configuration
│   ├── assets/                # Images and fonts
│   └── package.json
│
└── easeclassifieds-api/       # Backend (NestJS)
    ├── src/
    │   ├── modules/           # Feature modules
    │   │   ├── auth/          # Authentication
    │   │   ├── listings/      # Listings CRUD
    │   │   ├── search/        # Search service
    │   │   ├── subscription/  # Subscription management
    │   │   └── storage/      # File storage
    │   ├── db/
    │   │   └── migrations/    # Database migrations
    │   └── main.ts            # Application entry
    ├── .env                   # Environment variables
    └── package.json
```

## Getting Started

1. **Frontend (Web):**
   ```bash
   cd sandbox/easeclassifieds
   npm install
   npm run dev  # Runs on port 3000
   ```

2. **Mobile:**
   ```bash
   cd sandbox/easeclassifieds-mobile
   npm install
   npm start  # or expo start --tunnel
   # Scan QR code with Expo Go app on iOS/Android device
   ```

3. **Backend:**
   ```bash
   cd sandbox/easeclassifieds-api
   pnpm install
   cp .env.example .env
   pnpm run migration:run
   pnpm run start:dev  # Runs on port 3002
   ```

## Important Notes

- Frontend uses Vite proxy (`/api`) to communicate with backend
- Backend runs on port 3002 (not 3000)
- Phone authentication is required for most features
- Rate limiting is active - wait 60 seconds between OTP requests
- All database migrations have been executed
- TypeScript compilation is clean (no errors)

