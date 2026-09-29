# Beryl Shelter V2 — Global Theme System & Interactive Specification

This document serves as the canonical reference for the 3-mode theme system, semantic design tokens, interactive-state behavior, and accessibility standards across Customer Web, Admin Web, and Customer Mobile.

---

## 1. Core Architecture & Theme Modes

Beryl Shelter V2 implements a 3-mode theme system across all client applications:

| Mode | Behavior | Override Rule |
| :--- | :--- | :--- |
| **`SYSTEM`** *(Default)* | Dynamically tracks operating system / browser appearance (`prefers-color-scheme` / `useColorScheme()`). | Updates automatically whenever OS preference changes. |
| **`LIGHT`** | Enforces Light Mode appearance regardless of device/OS setting. | Explicit user selection. Survives OS appearance changes. |
| **`DARK`** | Enforces Dark Mode appearance regardless of device/OS setting. | Explicit user selection. Survives OS appearance changes. |

### Default Selection
New users or uninitialized devices default to `SYSTEM`. Once an explicit preference (`LIGHT` or `DARK`) is selected, it takes precedence until the user explicitly reverts to `SYSTEM`.

---

## 2. Client Persistence & Anti-Flash Mechanism

No backend database columns, migrations, or authentication dependencies are used for theme preferences. Themes are persisted entirely client-side:

* **Customer Web (`apps/web`)**:
  - Key: `localStorage.getItem("beryl_theme")`
  - Anti-flash: An inline `<script>` in the `<head>` of `apps/web/app/layout.tsx` executes synchronously before document rendering to apply `document.documentElement.setAttribute("data-theme", resolvedTheme)` and `document.documentElement.style.colorScheme = resolvedTheme`.
* **Admin Web (`apps/admin`)**:
  - Key: `localStorage.getItem("beryl_admin_theme")`
  - Anti-flash: Synchronous `<head>` script in `apps/admin/app/layout.tsx` applying `data-theme` attribute before hydration.
* **Customer Mobile (`apps/mobile`)**:
  - Key: `SecureStore` (native) / `localStorage` (web fallback) with key `beryl.v2.customer.theme_preference`.
  - Dynamically combines stored preference with `useColorScheme()` to drive `StatusBar` and Expo Router `Stack`/`Tabs` navigation headers.

---

## 3. Visual Language & Dark Mode Inspiration

The Dark Mode palette is directly derived from the approved *Beryl Shelter Executive Update* visual language:
- **Canvas / Background**: Near-black charcoal (`#0D1117`), avoiding harsh pure `#000000`.
- **Surfaces & Panels**: Elevated dark slate surfaces (`#161F28` / `#1A232F`), creating depth without clutter.
- **Borders & Dividers**: Restrained neutral lines (`#283545` / `rgba(255, 255, 255, 0.08)`).
- **Brand Accent**: Warm Beryl bronze / copper (`#BC8748` / `#C58B43` / `#DF9F4F`), used intentionally for active navigation, badges, and brand identity without overriding semantic meaning.
- **Typography**:
  - Primary text: Off-white (`#F1F5F9` / `#F4F6F8`) with WCAG AA contrast.
  - Secondary text: Muted neutral slate (`#94A3B8`).

---

## 4. Semantic Design Tokens

Both Light and Dark modes share a consolidated semantic token architecture:

| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--surface` / `background` | `#F7F7FA` / `#F7F5F2` | `#0D1117` | Canvas background |
| `--panel` / `surface` | `#FFFFFF` | `#161F28` | Header, sidebar, base cards |
| `--card-bg` / `surfaceMuted` | `#FFFFFF` / `#F1EEEA` | `#1A232F` | Elevated cards, tables, panels |
| `--ink` / `text` | `#080B10` / `#21170E` | `#F1F5F9` | Primary headings and body text |
| `--muted` / `textMuted` | `#475569` / `#6F675F` | `#94A3B8` | Subtitles, helpers, placeholders |
| `--line` / `border` | `#DCE0E7` / `#DED8D1` | `#283545` | Structural boundaries and borders |
| `--gold` / `brand` | `#B7864B` / `#BC8748` | `#C58B43` | Beryl brand accent, active items |
| `--gold-dark` / `brandDark` | `#966B37` / `#815914` | `#DF9F4F` | Hover/emphasis brand color |
| `--focus` | `#966B37` / `#2765D4` | `#38BDF8` / `#DF9F4F` | High-contrast focus rings |
| `--success` / `success` | `#15803D` / `#287A4C` | `#22C55E` | Approved / active / verified |
| `--warning` / `warning` | `#B45309` / `#9B671A` | `#F59E0B` | Pending / awaiting action |
| `--danger` / `danger` | `#B91C1C` / `#C93E3E` | `#EF4444` | Reject / delete / errors |

---

## 5. Interactive States & Defect Resolution

### The Admin "Reject" Button Defect
- **Root Cause**: In `apps/admin/app/globals.css`, the generic rule `button:hover { background: var(--brand-dark); }` forced all unstyled buttons into brown (`#825117`). In `admin-app.css`, `.property-reject` had a light red background and dark red text without an explicit `:hover` rule. On hover, the button became brown with dark red text, completely breaking contrast.
- **Resolution**: Explicit semantic states have been established across all interactive buttons:
  - **Light Mode `.property-reject`**:
    - Normal: `background: #fff4f3; border: 1px solid #b7312f; color: #b7312f;`
    - Hover: `background: #fee2e2; border-color: #dc2626; color: #991b1b;`
    - Active: `background: #fecaca; border-color: #b91c1c; color: #7f1d1d;`
    - Focus: `outline: 3px solid #dc2626; outline-offset: 2px;`
  - **Dark Mode `.property-reject`**:
    - Normal: `background: rgba(239, 68, 68, 0.12); border: 1px solid #ef4444; color: #fca5a5;`
    - Hover: `background: rgba(239, 68, 68, 0.25); border-color: #f87171; color: #ffffff;`
    - Active: `background: rgba(239, 68, 68, 0.35); border-color: #fca5a5; color: #ffffff;`
    - Focus: `outline: 3px solid #ef4444; outline-offset: 2px;`
  - **Approve button (`.property-approve`)**:
    - Light Hover: `background: #116938; color: #ffffff;`
    - Dark Normal: `background: rgba(34, 197, 94, 0.16); border-color: #22c55e; color: #4ade80;`
    - Dark Hover: `background: rgba(34, 197, 94, 0.28); border-color: #4ade80; color: #ffffff;`
  - **Withdrawal Reject button (`.reject-withdrawal`)**:
    - Light Hover: `background: #fee2e2; border-color: #dc2626; color: #991b1b;`
    - Dark Hover: `background: rgba(239, 68, 68, 0.25); border-color: #f87171; color: #ffffff;`

### General Interactive Audit
All interactive components (primary buttons, outline buttons, text buttons, links, inputs, selects, textareas, checkboxes, radio options, chips, modal backdrops, dropdowns, table rows, and tab items) maintain distinctive, accessible states for:
- Default
- Hover (desktop Web / Admin)
- Active / Pressed (Web / Admin / Mobile)
- Focus-Visible (accessible 2-3px ring with offset)
- Selected / Active Tab
- Disabled (`opacity: 0.48 - 0.65`, `cursor: not-allowed` / `wait`)

---

## 6. Controls Placement & Responsive Behavior

1. **Customer Web (`apps/web`)**:
   - Desktop: Segmented pill in `.header-actions` alongside the account menu / auth links.
   - Dashboard: Segmented pill in `dashboard-sidebar` above customer identity.
   - Mobile: Built into responsive drawer navigation (`.public-site-menu`) without horizontal scrolling, clipping, or viewport overflow.
2. **Admin Web (`apps/admin`)**:
   - Integrated into `.admin-topbar-actions` adjacent to the Admin profile menu.
   - Accessible across all desktop and tablet viewports.
3. **Customer Mobile (`apps/mobile`)**:
   - Prominent, dedicated `ThemeCard` in the `Account` tab with full descriptive cards for System, Light, and Dark.
   - Available to signed-in, signed-out, and session-recovery users.
