# Beryl Shelter mobile

The first Expo vertical slice implements customer signup, email OTP verification, a short success state, and Buyer/Seller onboarding placeholders.

## Setup

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`. It must be a reachable API URL, for example `http://192.168.x.x:5000/api/v1` for a physical device on the same LAN. Never place secrets in Expo public variables.

```bash
npm run dev:mobile
npm run test:mobile
npm run type-check:mobile
```

Use Expo Go for device testing. Android emulators commonly use `http://10.0.2.2:5000/api/v1`; iOS Simulator can often use `http://localhost:5000/api/v1`; physical devices need the development computer's LAN IP or a deployed API.

## Architecture

Expo Router provides the `(auth)` and `(onboarding)` route groups. React Hook Form/Zod validates signup locally. The typed fetch client calls only registration/verification endpoints. The verification context contains email, masked email, persona intent, and resend time in memory only. No password or OTP is persisted. `expo-secure-store` is reserved for a later authenticated refresh-token session boundary; AsyncStorage is not used for tokens.

After verification, the app immediately uses the active in-memory signup password to establish the customer session, then clears that password. If the app is terminated before that login can occur, the password is intentionally unavailable; the verified customer must use the future Login flow rather than recovering a password insecurely.

Buyer and Seller onboarding, skip behavior, status-based resume routing, and dashboard placeholders are now included. Next planned mobile flow: Login and refresh-token rotation.
