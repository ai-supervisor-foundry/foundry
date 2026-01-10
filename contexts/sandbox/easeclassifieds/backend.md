# EaseClassifieds Backend API - Context Documentation

## Overview
NestJS backend API for the EaseClassifieds classifieds platform. Provides RESTful API endpoints for authentication, listings, search, subscriptions, and more. Serves both **web** (`sandbox/easeclassifieds/`) and **mobile** (`sandbox/easeclassifieds-mobile/`) clients. Runs on port 3002.

## Project Structure
- **Location:** `sandbox/easeclassifieds-api/`
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL (via TypeORM)
- **Cache:** Redis/DragonflyDB
- **ORM:** TypeORM 0.3.20
- **Authentication:** JWT with phone OTP
- **Default Country:** Pakistan (PK) with +92 country code
- **Default Currency:** PKR (Pakistani Rupee)

## Key Configuration

### Port Configuration
- **API Port:** 3002 (configured in `.env` as `APP_PORT=3002`)
- **Base URL:** `http://localhost:3002`
- **API Prefix:** `/api` (global prefix)

### Database Configuration
- **Type:** PostgreSQL
- **Connection:** `postgresql://admin:admin@localhost:5432/tm-dev`
- **ORM:** TypeORM with migrations
- **Migrations:** 44 total migrations, all executed successfully

### Cache Configuration
- **Redis/Dragonfly:** Configured via `REDIS_URL`, `CACHE_STORE_URL`, `IO_REDIS_ADAPTER_URL`
- **Port:** 6499 (DragonflyDB)

## Mobile Client Support

The backend serves both web and mobile clients using the same API endpoints:

### Mobile-Specific Considerations
- **CORS:** Configure for Expo tunnel URLs during development (`https://*.exp.direct`)
- **Authentication:** Same phone OTP flow as web; mobile uses expo-secure-store for tokens
- **Response Shapes:** Optimized for mobile consumption (same contracts as web)
- **Rate Limiting:** Applied equally to web and mobile clients
- **API Base URL:** Mobile uses Expo tunnel in dev, production URL in prod

### Expo Tunnel Support
For mobile development, backend must be accessible via Expo tunnel:
```env
CORS_ORIGINS=http://localhost:3000,https://*.exp.direct
```

Mobile app connects to backend via tunnel URL provided by `expo start --tunnel`.

## Environment Variables

### Required in `.env`
```env
# Application
APP_PORT=3002
APP_BASE_URL=http://localhost:3002
FE_BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000

# Database
DB_URI=postgresql://admin:admin@localhost:5432/tm-dev

# Redis/Dragonfly
REDIS_URL=redis://localhost:6499
CACHE_STORE_URL=redis://localhost:6499
IO_REDIS_ADAPTER_URL=redis://localhost:6499

# JWT
JWT_SECRET=<secure-random-string>

# SendGrid (Email)
SENDGRID_API_KEY=<placeholder>
SENDGRID_FROM_EMAIL=<placeholder>

# AWS S3 (LocalStack for local dev)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_ENDPOINT=http://localhost:4566
AWS_S3_BUCKET=test-bucket

# Optional Services
TWILIO_ACCOUNT_SID=<optional>
STRIPE_SECRET_KEY=<optional>
PAYPAL_CLIENT_ID=<optional>

# Development/Sandbox Mode
# Controls development/sandbox mode explicitly for SMS OTP logging
# When true, OTPs are logged instead of sent via SMS
# Defaults to true if NODE_ENV is 'development', false otherwise
IS_DEV_SANDBOX=true

# OTP Rate Limiting (requests per time window)
# OTP_RATE_LIMIT_SHORT: requests per minute (default: 1, set to 1000 for testing)
# OTP_RATE_LIMIT_MEDIUM: requests per hour (default: 5)
# OTP_RATE_LIMIT_LONG: requests per day (default: 10)
OTP_RATE_LIMIT_SHORT=1
OTP_RATE_LIMIT_MEDIUM=5
OTP_RATE_LIMIT_LONG=10

# Disable Rate Limits in Development
# Set to 'true' to disable all rate limiting in development mode
# Defaults to true if NODE_ENV is 'development', false otherwise
# When enabled, both decorator-level and service-level rate limiting are bypassed
DISABLE_RATE_LIMITS=true
```

## API Endpoints

### Authentication (Phone OTP)
- `POST /api/auth/phone/request-otp` - Request OTP code
- `POST /api/auth/phone/verify-otp` - Verify OTP code
- `POST /api/auth/phone/resend-otp` - Resend OTP code
- `POST /api/auth/phone/refresh` - Refresh JWT token

### Listings
- `GET /api/listings` - Get all listings (with pagination)
- `POST /api/listings` - Create new listing
- `GET /api/listings/:id` - Get listing by ID
- `PUT /api/listings/:id` - Update listing
- `DELETE /api/listings/:id` - Delete listing

### Search
- `GET /api/search` - Smart search with filters
- `POST /api/search` - Advanced search

### Subscriptions
- `GET /api/subscriptions` - Get user subscriptions
- `POST /api/subscriptions` - Create subscription
- `PUT /api/subscriptions/:id` - Update subscription

## Recent Fixes Applied

### TypeScript Compilation Errors Fixed

1. **`auth.guard.ts:63` - Type Mismatch**
   - Fixed `normalizedUser` type to use `NormalizedUserPayload`
   - Added proper type assertion for `request.user`

2. **`jwt-auth.guard.ts:158` - Payload Type 'never'**
   - Added type assertion `payload as any` in fallback case

3. **`create-listing.dto.ts:104` - VehicleType.CAR Doesn't Exist**
   - Changed `VehicleType.CAR` to `VehicleType.SEDAN`
   - Valid enum values: SUV, SEDAN, TRUCK, MOTORCYCLE, COUPE, HATCHBACK, CONVERTIBLE, VAN, BUS

4. **`listings/entities/index.ts` - Duplicate Exports**
   - Replaced wildcard exports with explicit named exports
   - Used enums from base entity files to avoid conflicts

5. **`listing-base.entity.ts:12` - DiscriminatorColumn Not Found**
   - Removed `DiscriminatorColumn` import (not needed in TypeORM 0.3.20)
   - `TableInheritance` handles discriminator automatically

6. **`listings.service.ts:129` - Missing 'path' Property**
   - Added `path: ''` to `PaginateQuery` objects

7. **Image Processing Service - jpg/jpeg Type Issue**
   - Added 'jpg' to format type union
   - Added normalization to convert 'jpg' to 'jpeg'

8. **Storage Controller - Path Type Mismatch**
   - Added explicit `String()` conversion for path variable

9. **Payment Service - Stripe API Issues**
   - Updated Stripe API version to '2025-02-24.acacia'
   - Created product first, then used `product.id` in price_data

### Runtime Issues Fixed

1. **Circular Dependency - SubscriptionModule**
   - Used `forwardRef(() => AuthModule)` to break circular dependency

2. **Circular Dependency - SearchModule**
   - Used `forwardRef(() => ListingsModule)` to break circular dependency

3. **UserTier Enum Circular Dependency**
   - Defined `UserTier` enum locally in `subscription.entity.ts`

4. **TypeORM Enum Validation Error**
   - Added `enumName: 'user_tier'` to column decorator
   - Changed default from function to direct enum value

### Database Migrations Fixed

1. **CreateAggregationTables1766921071282**
   - Added conditional logic to check if `listings` table exists
   - Created tables without foreign keys initially, added constraints later

2. **CreateOtpTable1766945825038**
   - Added enum type creation before table creation
   - Created `otp_purpose_enum` type

3. **Backend003SchemaUpdates1766946065233**
   - Added existence checks for tables and columns before ALTER statements

4. **CreateFavoritesTable1768000000000**
   - Created table without foreign key initially
   - Added conditional logic to add foreign key only if `listings` table exists

## Key Modules

### Authentication Module
- **Location:** `src/modules/auth/`
- **Phone Auth:** `src/modules/auth/phone/`
- **Guards:** `auth.guard.ts`, `jwt-auth.guard.ts`
- **Strategy:** JWT with phone OTP

### Listings Module
- **Location:** `src/modules/listings/`
- **Entities:** Base, Property, Vehicle listings
- **Service:** CRUD operations with pagination
- **DTOs:** Create/Update listing DTOs

### Search Module
- **Location:** `src/modules/search/`
- **Features:** Smart search, filters, query parsing
- **Dependencies:** ListingsModule (circular dependency handled)

### Subscription Module
- **Location:** `src/modules/subscription/`
- **Features:** User tiers, subscription management
- **Payment:** Stripe integration
- **Dependencies:** AuthModule (circular dependency handled)

### Storage Module
- **Location:** `src/modules/storage/`
- **Features:** Image upload, processing, S3 storage
- **Image Processing:** Sharp library for resizing/format conversion

## Database Schema

### Key Tables
- `users` - User accounts
- `listings` - Base listings table (polymorphic)
- `listing_property` - Property listings
- `listing_vehicle` - Vehicle listings
- `subscriptions` - User subscriptions
- `favorites` - User favorites
- `otp_codes` - OTP verification codes
- `search_history` - Search query history
- `listing_sources` - Listing aggregation sources
- `listing_price_history` - Price tracking

### Enums
- `ListingCategory` - Categories (VEHICLES, PROPERTIES, etc.)
- `ListingStatus` - Status (ACTIVE, SOLD, DELETED, etc.)
- `PropertyType` - Property types (APARTMENT, HOUSE, etc.)
- `VehicleType` - Vehicle types (SUV, SEDAN, TRUCK, etc.)
- `FuelType` - Fuel types (PETROL, DIESEL, ELECTRIC, etc.)
- `UserTier` - Subscription tiers (FREE, BASIC, PREMIUM, etc.)
- `OtpPurpose` - OTP purposes (login, signup, password_reset, phone_verification)

## Rate Limiting

### Rate Limiting Architecture
Rate limiting is implemented at two levels:
1. **Decorator-level** (using `@nestjs/throttler`): Applied via `@ThrottleOTPRequest()` decorator
2. **Service-level** (custom Redis logic): Implemented in `phone-auth.service.ts` `checkRateLimits()` method

Both levels respect the `DISABLE_RATE_LIMITS` environment variable.

### OTP Request Limits
- **Short-term:** 1 request per minute (60 seconds) per phone number (configurable via `OTP_RATE_LIMIT_SHORT`)
- **Medium-term:** 5 requests per hour (3600 seconds) per phone number (configurable via `OTP_RATE_LIMIT_MEDIUM`)
- **Long-term:** 10 requests per day (86400 seconds) per phone number (configurable via `OTP_RATE_LIMIT_LONG`)

### IP-based Limits
- **Short-term:** 10 requests per minute per IP address
- **Medium-term:** 50 requests per hour per IP address

### Development Mode
- Set `DISABLE_RATE_LIMITS=true` to bypass all rate limiting in development
- When `NODE_ENV=development`, rate limiting is disabled by default unless explicitly set to `false`
- Both decorator-level and service-level rate limiting are bypassed when disabled

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
npm start

# Run migrations
npm run migration:run

# Generate migration
npm run migration:generate -- -n MigrationName

# Run tests
npm test
```

## Common Issues and Solutions

### Port Already in Use
- **Issue:** Port 3000/3002 already in use
- **Solution:** Kill process: `kill -9 <PID>` or change `APP_PORT` in `.env`

### Migration Errors
- **Issue:** Migrations fail due to table order
- **Solution:** Check migration timestamps, add existence checks

### Circular Dependencies
- **Issue:** Modules import each other causing runtime errors
- **Solution:** Use `forwardRef()` in module imports

### TypeORM Enum Issues
- **Issue:** Enum validation errors
- **Solution:** Add `enumName` property to column decorator

## Project Status

**Status:** ✅ Operational

All compilation errors fixed, database migrations executed, API running on port 3002. All modules initialize correctly, no runtime errors. Ready for development and testing.

## API Documentation

- **Swagger:** `http://localhost:3002/api-docs` (if enabled)
- **ReDoc:** `http://localhost:3002/docs` (if enabled)

## Next Steps

1. Replace placeholder values in `.env`:
   - Generate secure `JWT_SECRET`
   - Configure real SendGrid API keys
   - Set up AWS S3 credentials (or keep LocalStack)

2. Run database seeds (if needed):
   ```bash
   npm run test:seed
   ```

3. Start the API:
   ```bash
   npm start
   ```

