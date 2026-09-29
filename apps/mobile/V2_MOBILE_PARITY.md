# Beryl Shelter V2 Mobile parity

This checklist was produced from the current `apps/web` routes/components and `apps/api` routers. Current V2 Web/API behavior is authoritative; legacy screenshots are used only for mobile layout patterns.

Status meanings: **Complete** is implemented and validated, **Foundation** is routed with Phase 1 infrastructure, **Planned** is audited but not implemented, and **Web-only** is intentionally excluded from native product scope.

## Customer feature matrix

| Feature | Web route | Existing API | Auth | Mobile destination | Phase | Status | Notes |
|---|---|---|---|---|---|---|---|
| Home | `/` | `GET /api/v1/public/properties`; `POST /api/v1/public/property-searches` | Public | `/(tabs)` | 2 | Complete | Deterministic latest `LISTED` properties; there is no canonical featured flag, so no Featured section is fabricated. |
| About | `/about` | None | Public | Account → About/link | 7 | Planned | Informational content; may be native or an in-app Web link after final content audit. |
| Careers | `/careers` | None for content | Public | Account → Careers/link | 7 | Planned | Informational content is not a primary tab. |
| Career application | `/careers` | `POST /api/v1/public/careers/applications` | Public | Careers | 7 | Planned | Resume: PDF, 10 MB; requires document picker. |
| Public Analytics | `/analytics` | `GET /api/v1/public/analytics`; `POST /property-searches` | Public | Home/insights or Web link | 7 | Planned | Marketing analytics, separate from customer dashboard Analytics. |
| Public Referrals | `/referrals` | None until account action | Public | Account → Referrals information | 5 | Planned | Canonical commission is 2% / 200 bps. |
| Support/FAQ | `/support` | None for FAQs | Public | `/support` | 5 | Foundation route | Static FAQ/contact composition arrives with Support. |
| Report property/agent | `/support` | `POST /api/v1/public/support/reports` | Public | Support | 5 | Planned | Conditional Property/Agent payloads. |
| Buy marketplace | `/buy` | `GET /api/v1/public/properties` | Public | `/(tabs)/properties` | 2 | Complete | Server search/filter/sort, state/FCT, subtype, 7+, conveniences, pull-to-refresh and paginated load-more. |
| Property detail | `/buy/[propertyCode]` | `GET /api/v1/public/properties/:code` | Public | `/properties/[propertyCode]` | 2 | Complete | Public code deep link, gallery, metadata, location, save/share, mortgage connection and similar `LISTED` properties. |
| Contextual help | Shared public UI | None | Public | Contextual native help | 3/5 | Planned | Mobile modal/sheet; no duplicate backend. |
| Real Estate Inquiry | Property/contextual modal | `POST /api/v1/public/inquiries` | Public | Property detail inquiry | 3 | Complete | Contextual and standalone modal submitting to canonical inquiries API. |
| Buy Assistance | `/buy/assistance` | `POST /api/v1/public/buy-assistance` | Public | Properties → Assistance | 3 | Complete | Customer advisory request with optional PDF mandate document picker. |
| Sell Assistance | `/sell/assistance` | `POST /api/v1/public/sell-assistance` | Public | List → Assistance | 3 | Complete | Full assistance form with images and authorization document picker. |
| Register | `/register` | `POST /api/v1/auth/register` | Public | `/(auth)/register` | 1 | Foundation | Uses canonical account/profile classifications. |
| Email verification | `/verify-email` | context, verify and resend under `/api/v1/auth` | Challenge | `/(auth)/verify-email` | 1 | Foundation | Six-digit OTP; opaque verification token in SecureStore. |
| Login | `/login` | `POST /api/v1/auth/login`; `GET /me` | Public/session | `/(auth)/login` | 1 | Foundation | Email or phone; same Beryl customer session rows as Web. |
| Google login | `/login`, `/auth/callback` | `/api/v1/auth/google*` | Public/challenge | Auth | 6 | Planned | Current redirect targets Web; requires a later native redirect audit. |
| Password recovery | `/forgot-password*`, `/reset-password*` | forgot/resend/verify/context/reset under `/api/v1/auth` | Challenge/recovery | Auth recovery stack | 6 | Planned | Same opaque purpose-bound token transport is available to Mobile. |
| Session restoration | Shared Web auth | `GET /api/v1/auth/me` | Account | App root | 1 | Foundation | SecureStore token restored and validated on launch. |
| Logout | Shared Web auth | `POST /api/v1/auth/logout` | Account | Account | 1 | Foundation | Server session revoked; all local purpose tokens cleared. |
| Saved Properties | `/saved-properties` | `GET/POST/DELETE /api/v1/saved-properties`; `/states` | Account | `/saved-properties` | 2 | Complete | Session owner only; search, pagination, empty/error states and shared bookmark state. |
| Compare Properties | `/compare-properties*` | `GET /api/v1/saved-properties/compare` | Account | `/compare-properties` | 2 | Complete | In-session public-code selection, saved `LISTED` properties only, 2 minimum/3 maximum, horizontal native columns. |
| Mortgage Calculator | `/mortgage-calculator` | None | Public | `/(tabs)/mortgage` | 2 | Complete | Exact Web fixed-rate formula, zero-interest branch, formatted money inputs and optional public property prefill; no financial mutation. |
| Property Viewing | Property detail | `POST /api/v1/public/property-viewings` | Public | Property detail | 3 | Complete | Free physical viewing scheduling modal using canonical property code. |
| Property sharing | Property detail | Canonical public code/URL; `POST /api/v1/dashboard/referrals/public-property` for authenticated referral links | Public/account | Native Share | 2 | Complete | Plain `/buy/[propertyCode]` HTTPS links; canonical API-produced referral URLs; no UUID/private media. |
| Sell entry | `/sell` | Auth check | Mixed | `/(tabs)/list` | 3 | Complete | Signed-out customer login gate; signed-in listing wizard entry. |
| Create/edit listing | `/dashboard/listings/new`, `/:id/edit` | `GET /options`; `POST/PATCH /api/v1/listings` | Account | List/Listing editor | 3 | Complete | Step 1 property data + Step 2 Sales Mandate; lifecycle `UNLISTED → PENDING`. |
| Listing photos | Listing editor | multipart listing endpoints | Account | Listing editor | 3 | Complete | Image library picker with 5MB cap and previews. |
| Listing documents | Listing editor | `/listings/:id/documents` and download | Account | Listing editor | 3 | Complete | Registered title document uploads with PDF/image support. |
| Sales Mandate | Listing editor | `/listings/:id/mandate*` | Account | Listing editor | 3 | Complete | Part 1 vendor details, Part 2 10 legal clauses, 5% commission, 180 days, consent. |
| Signature | Sales Mandate | `POST /listings/:id/mandate/signature` | Account | Listing editor | 3 | Complete | Native touch drawing canvas with SVG path tracking and PNG export. |
| Listing submission | Listing editor | `POST /listings/:id/submit` | Account | Listing editor | 3 | Complete | Optimistic lock submit transitioning UNLISTED to PENDING with success step. |
| Listing rejection/resubmit | Dashboard listing | read/edit/request approval | Account | Listing detail/editor | 3/4 | Planned | Show canonical rejection reason; resubmit to `PENDING`. |
| Dashboard Overview | `/dashboard` | `GET /api/v1/dashboard/overview` | Account | `/dashboard` | 4 | Foundation route | Real counts/recent activity only. |
| Dashboard Listings | `/dashboard/listings*` | list/read/unlist/delete under `/api/v1/listings` | Account | `/dashboard/listings` | 4 | Foundation route | Search/filter and lifecycle actions from current API. |
| Customer Analytics | `/dashboard/analytics` | `GET /api/v1/dashboard/analytics` | Account | `/dashboard/analytics` | 4 | Foundation route | Real customer listing analytics. |
| Purchased Properties | `/dashboard/properties` | `GET /api/v1/dashboard/properties` | Account | `/dashboard/purchased-properties` | 4 | Foundation route | Immutable snapshots of verified offline purchases. No purchase action. |
| Messages/Tickets | `/dashboard/messages` | ticket list/read/create/reply/read/attachments under `/api/v1/messages` | Account | `/dashboard/messages` | 5 | Foundation route | `OPEN`/`RESOLVED`; resolved is read-only; no invented statuses. |
| Referrals | `/dashboard/referrals` | `GET/POST /api/v1/dashboard/referrals`; `/public-property` | Account | `/dashboard/referrals` | 5 | Foundation route | Buyer/seller referral links and canonical share URLs. |
| Referral deep link | Canonical shared URL | Referral attribution through current Web/API flow | Public | `/referrals/[referralCode]` | 5 | Foundation route | Public code only; attribution implementation remains canonical. |
| Referral history/earnings | `/dashboard/referrals` | `GET /api/v1/dashboard/referrals` | Account | `/dashboard/referrals` | 5 | Planned | Total earned, paid, pending/reserved, available and partial payment state. |
| Withdrawal summary/history | `/dashboard/referrals/withdraw` | `GET /api/v1/dashboard/referrals/withdrawals` | Account | `/dashboard/referrals/withdraw` | 5 | Foundation route | Includes minimum, bank readiness, balances and real request history. |
| Submit withdrawal | Same | `POST /api/v1/dashboard/referrals/withdrawals` | Account | Withdraw Earnings | 5 | Planned | Custom and 25/50/75/100% of available balance using exact integers. |
| Cancel withdrawal | Same | `POST /withdrawals/:withdrawalId/cancel` | Account | Withdraw Earnings | 5 | Planned | Only `PENDING`; never after processing starts. |
| Profile/avatar | `/dashboard/settings` | `GET/PATCH /api/v1/dashboard/settings/profile` | Account | `/dashboard/settings` | 6 | Foundation route | Avatar uses image upload. Email remains canonical read-only behavior. |
| Business profile | `/dashboard/settings` | `GET/PATCH /api/v1/dashboard/settings/business` | Account | Settings | 6 | Planned | Existing customer business contract. |
| Bank details | `/dashboard/settings` | Profile settings fields | Account | Settings | 6 | Planned | Canonical source for withdrawals; no duplicate bank table. |
| Change password | `/dashboard/settings` | `PATCH /api/v1/dashboard/settings/password` | Account | Settings | 6 | Planned | Revokes current sessions according to existing API behavior. |
| KYC | `/dashboard/kyc` | `GET/POST /api/v1/dashboard/kyc`; private document download | Account | `/dashboard/kyc` | 6 | Foundation route | Passport front; Driver's License/National ID front+back. No BVN. |

## Mobile exclusions

- All Admin functionality is Web-only: Admin auth, Users, Properties moderation, Leads, Referrers, withdrawal processing/payment, KYC review, tickets, invitations and SUPER_ADMIN functions.
- There is no online property checkout, payment gateway, escrow, ownership transfer or closing flow. Completed purchases are verified offline snapshots recorded by Beryl operations.
- Mobile does not initiate bank transfers. It submits customer withdrawal requests; Beryl transfers externally and Admin records a receipt-backed payout.
- Desktop-only layout constructs are not copied literally. Mobile uses tabs, stacks and compact account navigation while preserving the same business operations.

## Auth/API compatibility audit

Web used HTTP-only cookies plus exact-origin CSRF checks. React Native cannot reliably persist those cookies. Phase 1 adds a native transport to the same `customer_auth_sessions` records:

- Native requests have no browser `Origin` and identify the client with `X-Beryl-Client: mobile`.
- The random opaque Beryl account-session token is sent as a bearer token and stored with Expo SecureStore.
- Verification/recovery challenges remain purpose-bound and are transported in dedicated headers stored in SecureStore.
- Supabase access/refresh tokens remain encrypted server-side. No provider token, service-role key or private secret enters Mobile.
- Web cookie behavior and exact-origin protection remain unchanged. A browser request with an untrusted `Origin` is rejected even if it adds the Mobile marker.

## Withdrawal contract

`availableMinor = totalEarnedMinor - totalPaidMinor - reservedMinor`. `PENDING` and `PROCESSING` requests are reserved, not paid. The lifecycle is `PENDING → PROCESSING → PAID`, with `PENDING → REJECTED/CANCELLED`. Commission remains exactly 2% / 200 basis points. The configurable minimum and registered-bank readiness come from the existing API. Mobile creates no commission, payout, purchase, transfer, listing transition or Lead transition itself.

## Device capability audit

| Future capability | Current API use | Future native capability | Phase 1 permission/dependency |
|---|---|---|---|
| Listing photos | Listing multipart upload | Image library; camera only if product confirms direct capture | None |
| Listing/title documents | Private multipart upload/download | Document picker and image picker | None |
| Sales Mandate documents | Private PDF/image upload | Document picker | None |
| Sales Mandate signature | Private signature image | Touch drawing/signature surface | None |
| KYC documents | Private PDF/PNG/JPEG upload | Document/image picker; camera optional | None |
| Avatar | Settings profile multipart upload | Image picker/crop | None |
| Message attachments | Private message attachment upload/download | Document/image picker | None |
| Referral payout receipt | Admin-only Web flow | Excluded from Mobile | None |
| Property/referral share | Canonical public URLs | React Native `Share` | Built-in abstraction; no permission |

Phase 1 requested no media permissions. Phase 3 adds `expo-image-picker`, `expo-document-picker`, and `react-native-svg` for property media, title documents, and touch signature capture.

## Delivery phases

1. **Foundation (complete here):** parity audit, Expo Router shell, bottom tabs, customer auth/session/API transport, SecureStore, reusable design system, errors, sharing/deep-link routes.
2. **Discovery (complete):** Home, Buy, property details, Saved, Compare, Mortgage, property sharing and referral-aware property navigation.
3. **Property actions (complete):** Sell/List editor, media/documents, Sales Mandate/signature/submission, Sell Assistance, Buy Assistance, viewings and inquiries.
4. **Customer operations:** Dashboard Overview, Listings management, Analytics and Purchased Properties.
5. **Communication and earnings:** Messages/Tickets, Support, Referrals and Withdrawal Requests.
6. **Account:** Profile/avatar, Business, bank details, password/recovery, KYC and native Google-auth decision.
7. **Closure:** informational-page parity decisions, final API parity audit, physical device/accessibility regression and production/EAS readiness.
