# Beryl Shelter Admin Portal

The first Admin frontend slice provides protected Admin login, email OTP verification, a required first-password-change journey, and a minimal dashboard placeholder.

## Local setup

Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_BASE_URL` to the Express API base URL. It contains no secret values.

Run from the repository root:

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
npm run test:admin
npm run lint:admin
```

For a Vercel or Render deployment, configure `NEXT_PUBLIC_API_BASE_URL` for the deployed Express API and use `npm run build:admin` as the build command and `npm run start:admin` as the start command.

## Authentication architecture

Browser requests go to same-origin `/api/admin/*` handlers. Successful standard OTP verification places Admin access and refresh tokens in separate HttpOnly, `SameSite=Lax` cookies. A restricted initial-password-change proof is stored in a separate HttpOnly cookie and is never returned to browser JavaScript. The browser retains only non-sensitive OTP challenge metadata in `sessionStorage`.

The Admin backend currently has no mounted refresh or logout endpoint. The dashboard’s **Clear local session** control only clears browser cookies; it does not claim backend session revocation. This slice does not call unmounted backend endpoints.

## Current limitation

Route protection checks for the presence of Admin cookies and uses the server-side, HttpOnly session state cookie for display metadata. A mounted server-side Admin session validation/refresh endpoint is required before this can provide full runtime token validation and renewal.
