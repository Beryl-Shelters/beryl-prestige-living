# Beryl Shelter Nigeria Limited

Clean rebuild based on the client's approved existing Beryl Shelter website and workflows.

Previous implementation archived separately.

## Workspace

This repository contains the clean V2 foundation:

- `apps/web` — public Next.js application
- `apps/api` — Express API
- `apps/admin` — minimal Next.js admin placeholder
- `apps/mobile` — documented placeholder; Expo bootstrap is deferred
- `packages/config` — reserved for generic shared configuration
- `packages/types` — reserved for generic shared types

Install dependencies with `npm install`, then use the root scripts in
`package.json` to develop, type-check, lint, and build each bootstrapped app.

No legacy product features or domain models are part of this foundation.
