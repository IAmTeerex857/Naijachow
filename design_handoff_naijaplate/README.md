# Handoff: NaijaPlate — Nigerian Meal Planner (Desktop + Mobile)

## Overview
NaijaPlate is a meal-planning app for Nigerian home cooks. The user selects the finished
dishes they can make, and the app arranges them into a balanced multi-day plan (breakfast,
lunch, dinner) respecting soup-and-swallow pairing rules. Users can swap any meal, view
nutrition, open recipes, save/duplicate plans, order from local vendors, and upgrade to
Premium for longer plans.

This bundle contains **two** design references:
- **Desktop** — persistent side-rail layout (`NaijaPlate.dc.html`)
- **Mobile** — iPhone layout with bottom-tab navigation (`NaijaPlate Mobile.dc.html`)

Both share one design system, one data model, and one plan-building algorithm.

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — interactive
prototypes showing the intended look and behavior. They are **not** production code to copy
directly. They are authored as "Design Components" (a lightweight streaming-template runtime);
treat the markup as a visual/behavioral spec, not as a component library to import.

The task is to **recreate these designs in the target codebase's environment** using its
established patterns and libraries. A React + Vite scaffold already exists for this product
(see the project's `Food-App-3` folder / RESUME.md); prefer building there. The prototype's
plan-building logic (below and in the `<script>` block of each file) is directly portable to
plain JS/TS.

> Note: the existing React scaffold used Bricolage Grotesque + Sora. **This finalized design
> uses Hanken Grotesk throughout** — update the font stack to match these mocks.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interactions
are all specified. Recreate the UI pixel-accurately using the codebase's libraries. Dish/meal
photos are the only placeholders — they render as diagonal-stripe slots pending real images
from the backend image cache.

## Design Tokens

Tokens are CSS custom properties on a `[data-np-root]` element, themed via `data-theme`.

### Colors — Dark (default)
| Token | Value |
|---|---|
| `--bg` | `#0F0D0B` |
| `--bg2` | `#17140F` |
| `--surface` | `#1C1813` |
| `--surface2` | `#251F18` |
| `--ink` | `#F5EFE6` |
| `--ink2` | `#C3B9AB` |
| `--muted` | `#857B6C` |
| `--border` | `#2E2820` |
| `--border2` | `#3D362B` |
| `--orange` | `#F0813A` |
| `--orange-2` (hover) | `#E0672A` |
| `--orange-ink` (on orange) | `#1A0E06` |
| `--orange-soft` | `rgba(240,129,58,0.14)` |
| `--purple` | `#9B7BE0` |
| `--blue` | `#5FA9E0` |
| `--green` | `#69C08A` |
| `--purple-soft` | `rgba(155,123,224,0.16)` |
| `--blue-soft` | `rgba(95,169,224,0.16)` |
| `--green-soft` | `rgba(105,192,138,0.16)` |

### Colors — Light
| Token | Value |
|---|---|
| `--bg` | `#F5F1E8` |
| `--bg2` | `#FBF8F1` |
| `--surface` | `#FFFFFF` |
| `--surface2` | `#F3EEE2` |
| `--ink` | `#181410` |
| `--ink2` | `#4C463C` |
| `--muted` | `#968E7F` |
| `--border` | `#E7E0D1` |
| `--border2` | `#D7CFBC` |
| `--orange` | `#E06A22` |
| `--orange-2` | `#C4571A` |
| `--orange-ink` | `#FFFFFF` |
| `--orange-soft` | `rgba(224,106,34,0.10)` |
| `--purple` | `#6E4BC4` |
| `--blue` | `#2E7CB8` |
| `--green` | `#3E9C64` |
| soft variants | same hues at `0.10` alpha |

### Category color mapping
`soup → --orange`, `swallow → --purple`, `carb → --green`, `protein → --blue`, `fruit → --ink2`.
Each has a matching `-soft` background (fruit uses `--surface2`).

### Typography
- Family: **Hanken Grotesk** (Google Fonts), weights 400/500/600/700/800; fallback `system-ui, sans-serif`.
- `-webkit-font-smoothing: antialiased`.
- Scale (desktop → mobile):
  - Hero H1: 70px → 38px, weight 800, letter-spacing −0.035em, line-height ~1.0
  - Screen H1: 44px → 29–30px, weight 800, letter-spacing −0.03em
  - Section H2: 26px → 20px, weight 800, letter-spacing −0.02em
  - Card title: 16–20px, weight 700, letter-spacing −0.01em
  - Body: 15–20px → 14–16px, `--ink2`, line-height 1.5
  - Eyebrow/label: 11–12px, weight 700, letter-spacing 0.1–0.14em, `--muted`, uppercase
  - Stat numerals: 28px → 24px, weight 800, letter-spacing −0.02em
- Use `text-wrap: balance` on headings, `text-wrap: pretty` on paragraphs.

### Radius
Cards/panels 16–20px; pills/tags 999px; buttons 11–14px; inputs 12px; meal thumbnails 12px;
phone bezel 58px (inner), notch 0 0 18px 18px.

### Shadow
- `--shadow`: `0 1px 0 rgba(255,255,255,.04), 0 20px 46px -22px rgba(0,0,0,.82)` (dark) /
  `0 1px 2px rgba(24,20,16,.04), 0 22px 48px -24px rgba(24,20,16,.28)` (light)
- `--shadow-sm`: smaller variant, used on most cards.

### Placeholder fill (dish/meal images)
`--stripe`: `repeating-linear-gradient(45deg, var(--surface2) 0 10px, var(--bg2) 10px 20px)`
(light theme swaps the second stop for `#ECE6DA`). Replace with real `<img>` when photos exist.

### Spacing
Desktop screen padding `44px 72px 90px`; mobile screen padding `8px 18px 24px`. Card padding
18–28px. Grid/flex gaps 12–18px. Use flex/grid with `gap` (not margins) for sibling groups.

## Screens / Views

All screens live inside one root with a side rail (desktop) or bottom tab bar (mobile). Nav
targets: **Home, New Plan (select), Saved Plans, Vendors, Premium**. The New Plan tab stays
active through the `loading` and `plan` sub-states.

### 1. Home
- **Purpose:** entry point / value prop.
- **Layout:** hero (text + animated mascot GIF, orange radial blur behind it), then a 3-up
  "how it works" step grid (STEP 01–03), then a "Popular dishes" grid (5-up desktop / 2-up mobile).
- **Copy:** H1 "What can you **cook** today?" (cook in `--orange`); badge "Powered by AI meal
  pairing" with a green dot; CTAs "Start planning →" (orange) and "See saved plans" (outline).
- **Steps:** 01 Select your dishes / 02 We build the plan / 03 Cook & swap — each with a soft
  icon chip (orange square, purple circle, green square).

### 2. New Plan / Select
- **Purpose:** pick dishes + options, then generate.
- **Layout:** title block; search input + category chips row (chips scroll horizontally on
  mobile); dish grid (`repeat(auto-fill, minmax(170px,1fr))` desktop / 2-col mobile); two option
  cards (Fasting day, How many days); a **sticky bottom bar** showing selection count + primary CTA.
- **Dish card:** stripe thumbnail (height 84–108px) with monospace filename label bottom-left,
  title + category pill. Selected = 2px `--orange` border + orange ✓ badge top-right (24px circle).
- **Fasting toggle:** iOS-style switch (46×27px track, 21px white knob, orange when on). When on,
  reveals a Mon–Sun weekday picker (active = orange).
- **Duration:** chips 3 / 5 / 7 / 14 / 30; 14 & 30 marked `PREMIUM` (purple). Active = orange.
- **Rule:** CTA "Plan my meals →" is disabled until **≥ 3 dishes** selected. Status text:
  0 → "Tap dishes to select"; <3 → "select N more"; ≥3 → "ready".

### 3. Loading
- **Purpose:** generative moment (~2.4s) between Select and Plan.
- **Layout:** full-viewport centered; 2–3 blurred pulsing color orbs (orange/purple/blue),
  the mascot GIF floating, 5 equalizer bars animating, "Building your meal plan…" + subline.

### 4. Plan (result)
- **Purpose:** show the generated multi-day plan.
- **Layout:** header (H1 "Your N-day plan", Start over + Save plan buttons; "✓ Saved" appears
  after saving); a nutrition strip of 5 stats (AVG KCAL, PROTEIN, CARBS, FAT, BALANCE grade) —
  bordered row on desktop, horizontal-scroll cards on mobile; then one card per day.
- **Day card:** header with "Day N · Weekday" + kcal label. Non-fasting = 3 meals
  (BREAKFAST/LUNCH/DINNER) in a 3-col grid (desktop) or stacked rows (mobile). Fasting day = a
  "Rest & Renew" panel with hydration tag pills.
- **Meal:** stripe thumbnail, TYPE eyebrow, name, kcal + protein tags, and action row:
  **Nutrition/Info** (toggles an expandable macro panel), **▶ Recipe** (opens a YouTube search
  URL in a new tab), **Swap** (shows a "Swapping…" overlay ~650ms, then rotates to the next
  meal in that slot's pool).

### 5. Saved Plans
- **Purpose:** library of saved plans.
- **Layout:** header + "New plan" button; card grid (3-up desktop / 1-up mobile). Each card:
  stripe banner with a "N DAYS" pill, title, "date · avg kcal", dish summary, and Open /
  Duplicate buttons. Open rebuilds and navigates to the Plan screen; Duplicate prepends a
  "(copy)".
- Ships with 6 default saved plans; user-saved plans prepend to the list.

### 6. Vendors
- **Purpose:** order dishes from local kitchens.
- **Layout:** intro; card grid (2-up desktop / 1-up mobile). Each vendor: square stripe image,
  name + ★ rating, "area · ETA · price", cuisine tag pills, and an "Order now" button that
  flips to green "✓ Order placed" on click.

### 7. Premium
- **Purpose:** pricing.
- **Layout:** centered hero ("Plan further. Eat **better**.") over a purple radial blur; 3
  pricing tiers (3-up desktop / stacked mobile): **FREE ₦0**, **PREMIUM ₦2,500/mo** (featured:
  2px orange border + "MOST POPULAR" ribbon), **FAMILY ₦5,000/mo**. Each: name, price, tagline,
  ✓ feature list, CTA.

## Interactions & Behavior
- **Navigation:** side-rail buttons (desktop) / bottom-tab buttons (mobile) set the active
  screen. Active nav item = `--orange-soft` bg + orange text (desktop) / orange icon+label (mobile).
- **Generate:** requires ≥3 dishes → sets `screen:'loading'` → `setTimeout(2400ms)` → builds
  plan → `screen:'plan'`.
- **Swap:** marks `swapping[dayIndex-slot]=true`, `setTimeout(650ms)` advances that slot's meal
  index modulo the slot pool length, clears the flag.
- **Nutrition toggle:** toggles `expanded[dayIndex-slot]` to show/hide the macro breakdown.
- **Save:** snapshots current selection + duration into `userSaved`, sets `justSaved=true`.
- **Theme toggle:** flips `data-theme` between `dark`/`light` on the root; transition
  `background .4s, color .4s`.
- **Order:** sets `orderedVendor` to that vendor's name (button → green confirmed state).
- **Animations:** `@keyframes` — `rise` (screen enter, translateY+fade ~0.45–0.5s),
  `floaty` (mascot, 4s), `pulse` (loading orbs, 3s), `bar` (equalizer, 1.1s staggered),
  `orbA` (hero blur drift, 16s), `spin` (unused/available). Hover states darken orange to
  `--orange-2` and lift text color toward `--ink`.

## State Management
Single component holds all state (port to a store/context in the real app):
- `theme` `'dark'|'light'`
- `screen` `'home'|'select'|'loading'|'plan'|'saved'|'vendor'|'premium'`
- `selected` `Set<dishId>`; `search`, `cat`, `fasting`, `fday`, `duration`
- `plan` (array of day objects), `pools` (breakfast/lunch/dinner combo arrays), `planDuration`
- `expanded {}`, `swapping {}` (keyed `dayIndex-slot`)
- `userSaved []`, `justSaved`, `orderedVendor`
- **Data fetching (real app):** replace the local `FOODS`, `VENDORS`, and stripe placeholders
  with the Supabase image cache + vendor data; the plan generator can stay client-side or move
  to the existing Netlify function per the PRD contracts (see RESUME.md).

## Plan-building algorithm (portable — lift verbatim)
- `groupsFrom(ids)` buckets selected ids by category.
- `buildPools(ids)` builds breakfast/lunch/dinner **combo pools**: breakfast from a BREAKFAST
  id set (± a fruit); lunch = carb × protein; dinner = soup × swallow, plus carb × protein;
  with graceful fallbacks so a plan always builds.
- `buildPlan(ids, duration, fasting, fday)` produces `duration` days, each picking a combo by
  `dayIndex % pool.length`; the fasting weekday becomes a rest day.
- `expandMeal(slot, combo)` sums per-category macros from `CAT_CAL` and joins dish names.
- `calcNutrition` averages non-fasting days for the stat strip; BALANCE grade = A / A− / B+ by
  average protein (≥34 / ≥26 / else).

## Assets
- **Mascot:** `uploads/bloub-cercle-excite-orange.gif` (animated orange character), used in the
  Home hero and Loading screen. (An SVG variant exists: `bloub-cercle-excite-orange-anime.svg`.)
- **Dish/meal photos:** none bundled — placeholders are CSS stripe fills labeled with an
  `<id>.jpg` filename hint. Source real photos from the backend image cache; ids match the
  60-dish catalogue in the `FOODS` array.
- **Icons:** all drawn with CSS/borders (no icon font). Replace with the codebase's icon set if desired.
- **Fonts:** Hanken Grotesk via Google Fonts.

## Files
Included in this bundle:
- `NaijaPlate.dc.html` — desktop design (side rail, all 7 screens, full logic).
- `NaijaPlate Mobile.dc.html` — mobile design (iPhone frame, bottom tabs, all 7 screens).
- `NaijaPlate Design System.dc.html` — token + component reference.
- `assets/bloub-cercle-excite-orange.gif` — mascot.
- `RESUME.md` — prior React/Vite + Netlify backend notes (fonts differ; use this doc's tokens).

Open any `.dc.html` in a browser to view the interactive prototype. All application logic lives
in the `<script data-dc-script>` block at the bottom of each file.
