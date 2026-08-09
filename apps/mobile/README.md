# Beryl Shelter mobile

The Expo customer application covers signup, email OTP verification, Buyer and Seller/Developer onboarding, login, password reset, SecureStore-backed customer sessions, persona activation/switching, and dashboard placeholders.

## Local development

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL`. A physical device can use a reachable LAN API URL during local development; it cannot reach `localhost` on the development computer.

```bash
npm run dev:mobile
npm run type-check:mobile
npm run test:mobile
```

Expo Go is useful for fast JavaScript iteration. Use an EAS development or preview build for acceptance testing because this app includes native dependencies such as `react-native-keyboard-controller`, `expo-secure-store`, `react-native-screens`, and `react-native-safe-area-context`.

## EAS builds

Run EAS commands from this directory so the mobile Expo project is selected. The repository root `package.json` and `package-lock.json` remain the workspace dependency source; do not copy `node_modules` into an EAS upload.

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build:configure
```

`build:configure` is the one required interactive project-linking step. It may associate this app with the temporary developer Expo account and add the real EAS project linkage. Do not invent or manually add `extra.eas.projectId`; the EAS project can later be transferred to the client's Expo account.

### EAS environments

Create `EXPO_PUBLIC_API_BASE_URL` in the Expo dashboard under **Project Settings → Environment variables**, scoped to each environment:

- `development`: reachable development API.
- `preview`: deployed HTTPS staging/live API.
- `production`: deployed HTTPS production API.

The same variable can be created with the EAS CLI after the project is linked; use `npx eas-cli@latest env:create --help` to confirm the current supported options before creating it. `EXPO_PUBLIC_*` values are embedded in the mobile client, so the API base URL is acceptable but secrets are not. Never put Supabase service-role keys, Resend keys, Cloudinary secrets, JWT/OTP secrets, database credentials, or admin tokens in an Expo public variable.

### Profiles

`eas.json` provides three profiles:

- **development** — internal distribution development client for engineers. It includes native modules and is not the primary client-sharing build.
- **preview** — internal distribution. Android explicitly produces an installable APK for QA/client testing; no Play Store publication occurs.
- **production** — future store-ready defaults (Android AAB through EAS defaults), with remote EAS app-version management and automatic build-number increments. Do not run this profile until the client owns the relevant store accounts.

The public app version stays `1.0.0`. EAS remote version management owns native build numbers after the project is linked; this avoids committing conflicting Android `versionCode` or iOS `buildNumber` values.

### Build commands

```bash
# Android
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform android --profile preview

# iOS
npx eas-cli@latest build --platform ios --profile development
npx eas-cli@latest build --platform ios --profile preview

# Both preview artifacts, if required
npx eas-cli@latest build --platform all --profile preview
```

Do not run these commands automatically from CI or a local script unless the account owner intends to consume EAS build quota. On the first build, EAS may interactively generate/manage Android and Apple credentials. Never commit keystores, certificates, provisioning profiles, or their passwords.

### Android preview APK installation

1. Configure the `preview` EAS environment with a deployed HTTPS API URL.
2. Run `npx eas-cli@latest build --platform android --profile preview`.
3. Wait for EAS to provide the build URL; no Play Store submission is involved.
4. Open that URL on the Android device and download the APK.
5. Allow installation from the browser or file manager if Android asks.
6. Install, launch Beryl Shelter, and test against the configured HTTPS backend.

### iOS internal distribution

An Apple Developer Program membership is required for signed physical-device development and ad hoc/internal builds. Before an iOS preview build, register the test device through EAS (for example, `npx eas-cli@latest device:create`) and allow EAS to guide provisioning. Registered devices are included in the provisioning profile and can install the internally distributed IPA from the EAS installation URL where supported. An arbitrary iPhone cannot install an internal build without the required Apple signing and device provisioning.

### Client preview checklist

- Signup and email OTP.
- Buyer onboarding and Seller/Developer onboarding.
- Login, forgot-password, reset-password, logout, and session restore.
- Persona activation and persona switching.
- Keyboard-aware form scrolling and password-strength feedback.

Preview builds must target the deployed HTTPS API, not `localhost`, `127.0.0.1`, or a LAN-only address.

## Assets

The existing `assets/brand/beryl-shelter-logo.png` is preserved. No dedicated app icon, Android adaptive icon, or splash image is currently configured. Add approved square/icon and splash assets later before public store release; EAS configuration itself does not depend on them.
