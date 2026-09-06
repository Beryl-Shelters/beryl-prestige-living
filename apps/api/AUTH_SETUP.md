# Customer authentication (V2)

This is code and a migration only. No hosted project, provider, email sender or
deployment has been configured by this change. `/account` is a temporary minimal
authenticated entry, not a dashboard. Existing auth page layouts are retained.

## Architecture

Web uses `NEXT_PUBLIC_API_BASE_URL` (an origin, without `/api/v1`) and a single
credentials-included API client. Only the API has Supabase credentials. Supabase
Auth performs password hashing, signup, verification, recovery and Google PKCE.
An anonymous/public-key client performs normal auth; a separate service-role
client reads private profiles and manages private application sessions.

The browser holds random opaque HttpOnly cookies. The API stores SHA-256 token
hashes and AES-256-GCM-encrypted Supabase access/refresh tokens in
`customer_auth_sessions`. This is session storage, not a second identity or OTP
system. Database time controls absolute session expiry and recovery consumption.
The default account lifetime is seven days; a recovery grant lasts ten minutes.
Refresh is serialized by a database lease and never extends the absolute expiry.
An expired/revoked application session cannot be replayed after logout.

The session helper calls Supabase `getUser` and requires email confirmation.
`/me` returns only the caller's profile. `/account` renders no private server data:
it waits for `/me` before displaying authenticated controls. Future private API
routes must reuse `AuthSessions.account`; a client route guard is not authorization.

Recovery OTPs are verified with type `recovery`; signup codes use type `signup`.
The resulting recovery session never becomes an account session. An atomic DELETE
consumes the recovery grant before the password update; all application sessions
for that customer are invalidated. A failed provider update requires a new OTP.
Supabase global sign-out is then requested. Standalone Supabase JWTs remain
subject to Supabase's own expiry/revocation behavior; the application additionally
requires its private live session record.

## Environment

Copy the example files yourself and supply values for the correct V2 project.
Build/type-check require no secrets. Missing required auth configuration makes
auth routes return `AUTH_UNAVAILABLE`; `/health` remains available.

| Variable | Location | Meaning |
| --- | --- | --- |
| `SUPABASE_URL` | API | V2 project URL |
| `SUPABASE_ANON_KEY` | API | V2 public/anon key for normal Auth operations |
| `SUPABASE_SERVICE_ROLE_KEY` | API | Privileged V2 server credential |
| `AUTH_ENCRYPTION_KEY` | API | 32 random bytes in base64, stable across instances |
| `WEB_APP_URL` | API | Exact allowed Web origin, no path/trailing slash |
| `API_PUBLIC_URL` | API | API origin, no path/trailing slash |
| `AUTH_COOKIE_SECURE` | API | `true` on HTTPS; defaults true in production |
| `AUTH_COOKIE_SAME_SITE` | API | `lax` default; `none` requires Secure |
| `AUTH_SESSION_SECONDS` | API | 300-604800 seconds, default 604800 |
| `AUTH_RATE_WINDOW_MS` | API | Default 900000 (15 minutes) |
| `AUTH_RATE_LIMIT` | API | Default 30 sensitive POSTs per IP/window |
| `TRUST_PROXY_HOPS` | API | Actual trusted proxy count, default 0 |
| `AUTH_GOOGLE_ENABLED` | API | `false` until provider setup is complete |
| `NEXT_PUBLIC_API_BASE_URL` | Web | Public API origin; baked in at Web build time |

Use a secret manager to generate/store the encryption key (32 cryptographically
random bytes, base64 encoded). Do not use example keys. Rotating the key invalidates
existing sessions/challenges; never put it or the service-role key in Web variables.

| Environment | Web origin | API origin | Cookies |
| --- | --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:4000` | Secure=false, SameSite=lax |
| Preview | `https://dev.berylshelter.com` | `https://dev-api.berylshelter.com` | Secure=true, SameSite=lax |
| Future production | `https://app.berylshelter.com` | `https://api.berylshelter.com` | Secure=true, SameSite=lax |

Cookies are host-only (no Domain attribute), Path=/; Secure cookies use `__Host-`
names. This keeps Preview and Production sessions separate. Use the same hostname
for local Web and API (do not mix localhost and 127.0.0.1). CORS permits only the
configured Web origin with credentials. Mutations additionally require that exact
Origin and JSON Content-Type. Distinct hosting sites may require SameSite=None,
HTTPS and a browser policy that permits third-party cookies; the approved sibling
subdomains work with Lax. Requests must go through the configured trusted proxy.

The built-in rate limiter is per API process. Keep Supabase's Auth rate limits
enabled and configure a shared gateway limit before scaling to multiple instances.
Do not set trust proxy to an arbitrary/unbounded value. No CAPTCHA or SMS is added.

## Manual Supabase setup (not performed)

1. Select the clean V2 project for this environment. Apply
   `supabase/migrations/202609060001_customer_auth_foundation.sql` once through
   the project's normal migration process. It creates only new customer tables,
   policies/functions and triggers on `auth.users`; it references no legacy tables.
   It assumes the V2 customer profile tables/functions do not already exist.
2. Authentication > Providers/Sign In > Email: enable Email/password and **Confirm
   email**, allow new signups, use a password minimum of at least 12 characters.
   Signup checks `/auth/v1/settings` and refuses to create an identity if email
   autoconfirm is enabled. Enable leaked-password protection where available.
3. Set email OTP length to **6** and expiry to **600 seconds** in the project's
   Auth email settings. The UI expects six digits; Supabase is the OTP clock and
   consumption authority. Keep resend/rate limits enabled (at least 60 seconds
   between deliveries). The app's 30-minute pending context is not OTP validity.
4. Authentication > Email Templates: both **Confirm signup** and **Reset password**
   must visibly render `{{ .Token }}`. Replace automatic sign-in/confirmation-link
   CTAs with instructions to enter that code on the already-open Web page.
   The recovery template sends to the Auth account email, even when initiation
   uses a phone number. Do not add a separate application email/OTP sender.
5. Configure Supabase custom SMTP with a verified sender/domain for delivery to
   real customers. Its default sender can be restricted to project members and
   low sending limits; a successful API request alone is not proof of delivery.
6. Authentication > URL Configuration: set the Site URL to this environment's Web
   origin. Allow its `/auth/callback` URL, including query parameters used for PKCE
   state (use the narrowly scoped `/auth/callback**` pattern if the dashboard's
   matching requires a wildcard). Also allow `http://localhost:3000/auth/callback**`
   in the development project. Never use an unrestricted host wildcard.
7. For Google activation: create a Google OAuth Web client and consent screen;
   authorize the relevant Web origin. Set Google's authorized redirect URI to
   `https://<V2-project-ref>.supabase.co/auth/v1/callback` (or the callback displayed
   by your Supabase provider panel). Enter Client ID/Secret in Supabase's Google
   provider panel, enable it, then set `AUTH_GOOGLE_ENABLED=true` in the API.
   The client secret belongs in Supabase, not the browser or repository.
8. Verify Google redirect returns to Web `/auth/callback?state=...&code=...`.
   The Web page POSTs the one-time code/state to the API. The API checks encrypted
   state and exchanges the code using its server-held PKCE verifier. Codes are
   removed from browser history. No arbitrary return URL is accepted.

Google signup triggers a profile insert in the same transaction as the Auth user.
Available given/family names are copied; phone, account type and profile type are
nullable. Existing profiles retain their values when Google is linked. No profile
completion screen is created. Manual signups require all approved fields.

The profile has unique normalized email and E.164 phone. Phone is an identifier,
not independently verified ownership; no SMS verification is implemented.
National phone login uses Nigeria as the default; other countries use +country code.
Authenticated database users can SELECT only their own profile and UPDATE only
first/last names. Email, verification time, identifiers and session records cannot
be edited with a customer JWT. No profile update UI/API is part of this pass.

## API contract

All paths below begin `/api/v1/auth`. Success: `{success:true,data:...}`.
Failure: `{success:false,error:{code,message}}`. Responses use `Cache-Control:no-store`.
Never log request bodies, identifiers, OTPs, tokens, cookies, or provider error text.

| Method/path | Body / result |
| --- | --- |
| POST `/register` | Approved form fields; 201 + masked email and verification cookie |
| POST `/login` | identifier/password; account cookie, no tokens in JSON |
| GET `/verification-context` | Masked email from pending verification cookie |
| POST `/verify-email` | code; account cookie after successful signup OTP |
| POST `/resend-verification` | optional identifier, otherwise pending cookie |
| GET `/me` | Current confirmed customer; refreshes provider tokens when needed |
| POST `/logout` | {}; invalidates all this customer's application sessions |
| POST `/forgot-password` | identifier; enumeration-safe delivery message |
| POST `/resend-recovery` | {}; pending recovery context required |
| POST `/verify-recovery` | code; restricted single-use recovery cookie |
| GET `/recovery-context` | Validates pending password-update authorization |
| POST `/reset-password` | password/confirmPassword; recovery cookie required |
| POST `/google` | {}; configured Supabase authorization URL or clear unavailable error |
| POST `/google/callback` | code/state; PKCE exchange and account cookie |

Registration conflicts use one `ACCOUNT_EXISTS` error, without naming the collided
identifier. Recovery initiation has identical public status/body for known/unknown
identifiers and delivery failures; it does not return a resolved or masked email.
This avoids a direct enumeration oracle, not a claim of constant network timing.
OTP errors intentionally combine invalid/expired; the user can resend. Provider
rate limits become safe 429 errors except recovery initiation, whose public reply
remains generic. API IP limits always apply.

## Verification still required against the configured V2 project

Run the API tests with `npm test --workspace=@beryl/api`. They cover real Express
routes with an injected provider/repository plus the real Supabase SDK using a
stubbed HTTP transport. They do not run hosted SQL or send real OTP messages.
No Web test framework has been installed solely for this pass.

After manual setup, verify: signup creates exactly one unverified profile; duplicate
phone/email constraints reject races; email OTP confirms the profile; both phone
formats log in; resend respects limits; unknown recovery responses stay generic;
expired/reused OTPs fail; recovery grants cannot access `/me`; replay/concurrent
reset fails; logout and reset invalidate old application cookies; expired provider
access tokens refresh without losing the account session; Google creates/links the
expected profile. Inspect DevTools to verify host-only HttpOnly/Secure cookies,
credentialed CORS, and rejected foreign-Origin POSTs. Test Preview separately from
Production; never point Preview at the production project to work around setup.

On the database, test RLS with two authenticated customer IDs: each sees only its
own profile; updates to email/account/session columns are denied; anonymous access
to both tables is denied; session RPCs are executable only by service_role. A
service-owned maintenance job may periodically delete expired rows from
`customer_auth_sessions`; they are already unusable after their expiry.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[password authentication](https://supabase.com/docs/guides/auth/passwords),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).
