# Beryl Shelter customer web

This Next.js App Router application contains only the Beryl Shelter Nigeria Limited customer authentication and onboarding experience. Public property pages, production dashboards, admin features, and native mobile code are intentionally out of scope.

## Authentication architecture

Browser code calls the same-origin `/api/customer/*` bridge. The bridge forwards only an explicit allowlist of customer-auth and onboarding paths to the server-only `API_BASE_URL`. Access tokens, rotating refresh tokens, and short-lived password-reset proofs are removed from browser-visible responses and stored in Secure (in production), HttpOnly, SameSite=Lax cookies. Protected requests attach the access token server-side; a 401 triggers one refresh-token rotation and one retry. Logout and successful password reset clear session cookies.

The customer identity, active persona, persona list, and `nextAction` are mirrored in an HttpOnly state cookie for server-backed session restoration. `sessionStorage` contains only non-secret, tab-scoped flow hints (email, masked email, and signup intent). The signup password is held in memory just long enough to establish a session after email verification and is never written to web storage.

## Local setup

Copy `.env.example` to `.env.local` and set the Express API base, normally:

```txt
API_BASE_URL=http://localhost:5000/api/v1
```

Preview:

```txt
API_BASE_URL=https://dev-api.berylshelter.com/api/v1
```

Set the production value to the branded production API only when promoting a verified release. `API_BASE_URL` remains server-only; browser code uses same-origin BFF routes.

From the repository root, run `npm run dev:web`. Validation commands are `npm run lint:web`, `npm run type-check:web`, `npm run test:web`, and `npm run build:web`.

## Assets

The buyer and seller photographs extracted from the supplied design live in `public/images/auth`. The supplied PNG logo and favicon set are centralized in `public/brand`; the shared `BerylShelterLogo` lockup uses `android-chrome-192x192.png`. The exact Figma envelope/lock illustrations were not supplied; reserved paths are `public/icons/otp-envelope.svg` and `public/icons/password-lock.svg`.
