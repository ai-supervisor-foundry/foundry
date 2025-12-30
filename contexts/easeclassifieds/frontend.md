# EaseClassifieds Frontend - Context Documentation

## Overview
React + TypeScript + Tailwind CSS frontend application for a full-stack classifieds super app. Located in `sandbox/easeclassifieds/`. Connects to NestJS backend API running on port 3002.

## Project Structure
- **Location:** `sandbox/easeclassifieds/`
- **Framework:** React 18+ with Vite
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **State Management:** React hooks (useState, useEffect, useContext)
- **Routing:** React Router
- **API Client:** Axios-based service layer
- **Default Country:** Pakistan (PK) with +92 country code
- **Default Currency:** PKR (Pakistani Rupee)

## Key Configuration

### API Configuration
- **Base URL:** Uses Vite proxy (`/api`) which forwards to `http://localhost:3002/api`
- **Proxy Config:** `vite.config.ts` - proxy target set to port 3002
- **Environment Variables:** `VITE_API_BASE_URL` (defaults to `/api`)

### Authentication Endpoints
- **Request OTP:** `POST /api/auth/phone/request-otp`
- **Verify OTP:** `POST /api/auth/phone/verify-otp`
- **Resend OTP:** `POST /api/auth/phone/resend-otp`
- **Refresh Token:** `POST /api/auth/phone/refresh`

### Port Configuration
- **Frontend Dev Server:** Port 3000 (Vite default)
- **Backend API:** Port 3002 (configured in Vite proxy)

## Recent Fixes Applied

### Compilation Errors Fixed
1. **Duplicate `UserTier` Import** (`App.tsx`)
   - Removed duplicate import from line 14
   - Kept import on line 4

2. **JSX Comment Syntax** (`App.tsx` line 904)
   - Changed from `/* comment */` to `{/* comment */}` inside JSX

3. **Missing Closing Tag** (`App.tsx` HomeRoute)
   - Added missing `</div>` for `px-4` div

4. **Duplicate Exports** (`components/ErrorBoundary.tsx`)
   - Removed named export, kept only `export default ErrorBoundary`

### API Configuration Fixes
1. **Authentication Endpoints** (`services/api.ts`)
   - Updated `sendOTP()`: `/auth/send-otp` → `/auth/phone/request-otp`
   - Updated `verifyOTP()`: `/auth/verify-otp` → `/auth/phone/verify-otp`

2. **API Base URL** (`services/api.ts` line 39)
   - Changed from `http://localhost:3000/api` to `/api` (uses Vite proxy)

3. **Vite Proxy Target** (`vite.config.ts` line 32)
   - Updated from port 3001 to port 3002

## Key Files

### Core Application
- **`App.tsx`** - Main application component with routing and state management
- **`main.tsx`** - Application entry point
- **`vite.config.ts`** - Vite configuration with proxy setup

### Services
- **`services/api.ts`** - Axios-based API client with authentication methods
  - `sendOTP(phone: string)` - Request OTP code
  - `verifyOTP(phone: string, code: string)` - Verify OTP code
  - Base URL configuration and interceptors

### Components
- **`components/ErrorBoundary.tsx`** - Error boundary for React error handling
- **`components/Layout.tsx`** - Main layout wrapper
- **`components/BottomNav.tsx`** - Bottom navigation component

### Types
- **`types.ts`** - TypeScript type definitions
  - `ListingCategory`, `SmartSearchResponse`, `UserTier`, `Listing`
  - `RequestOTPRequest`, `VerifyOTPRequest`, `SearchFilters`
  - `FeedMetadata`, `UserSubscription`, `TierUpgradeRequest`

## Features Implemented

### Authentication Flow
- Phone number input screen with country code selector
- Default country: Pakistan (+92)
- OTP verification screen
- Token management (JWT)
- Auto-refresh token logic
- Rate limiting error handling
- International phone number support

### Main Features
- Daily curated feed
- Smart search with filters
- Category navigation (vehicles, properties)
- Favorites functionality
- Profile and subscription management
- Listing creation and editing

## Rate Limiting

### OTP Request Limits (from backend)
- **Short-term:** 1 request per minute per phone number
- **Medium-term:** 5 requests per hour per phone number
- **Long-term:** 10 requests per day per phone number

### IP-based Limits
- **Short-term:** 10 requests per minute per IP
- **Medium-term:** 50 requests per hour per IP

### Development Mode
- Rate limiting can be disabled in development by setting `DISABLE_RATE_LIMITS=true` in backend `.env`
- When disabled, no rate limit errors will occur during testing

### Testing Notes
- In development mode with `DISABLE_RATE_LIMITS=true`, no waiting required
- Otherwise, wait 60 seconds between attempts for same number
- Use different phone numbers to bypass limits
- Service worker cache may require hard refresh

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

```env
VITE_API_BASE_URL=/api
VITE_PROXY_TARGET=http://localhost:3002
```

## Common Issues and Solutions

### Service Worker Cache
- **Issue:** Old code persists after fixes
- **Solution:** Unregister service workers, hard refresh browser

### Vite Proxy Not Working
- **Issue:** API calls fail after proxy config change
- **Solution:** Restart Vite dev server

### Rate Limiting
- **Issue:** Cannot test authentication immediately
- **Solution:** Wait 60 seconds or use different phone number

## Testing Status

### ✅ Working
- Frontend compiles without errors
- All syntax errors fixed
- API endpoints correctly configured
- Vite proxy configured for port 3002
- Authentication API connection working
- Error handling displays properly
- UI components load correctly

### ⚠️ Requires Authentication
- Home feed and daily curated listings
- Search functionality
- Category navigation
- Favorites functionality
- Profile page and subscription management
- Listing creation and editing

## Backend Integration

- **Backend Port:** 3002
- **Global API Prefix:** `/api`
- **CORS:** Configured for `http://localhost:3000`
- **Authentication:** JWT-based with phone OTP

## Project Status

**Status:** ✅ Functional and ready for development

All compilation errors fixed, API connectivity verified, authentication flow working. Ready for feature development and testing.

