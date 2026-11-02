# Atlas — personal travel dashboard

A private, single-user app for planning and tracking a trip around the world: countries, cities, itineraries, places, budget, memories and documents in one calm, photo-forward place. It works on the phone while travelling (installable as a PWA).

Built with **Next.js 16** (App Router, React 19, TypeScript strict), **Tailwind CSS v4** with hand-built shadcn-style components, **Supabase** (Postgres, Auth, Storage via `@supabase/ssr`), **d3-geo** for the world map, **Leaflet + OpenStreetMap tiles** for city and day maps, and **Recharts**.

---

## What you must do manually

1. **Create a Supabase project, then copy the Project URL and anon key into `.env.local`.**
   - [supabase.com](https://supabase.com) → **New project** (any name, pick a region near you, save the database password somewhere).
   - When it is ready: **Project Settings → API** (or **Connect → App frameworks**). Copy **Project URL** and the **anon public** key.
   - In this folder: `cp .env.example .env.local`, then paste:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
     ```
   - The `service_role` key is optional and only for share links; see [Share links](#share-links). Never prefix it with `NEXT_PUBLIC_`.
2. **Run the files in `supabase/migrations/` in order in the Supabase SQL editor: `001`, `002`, `003`, `004`.**
   - Dashboard → **SQL Editor** → **New query** → paste the *whole* file `supabase/migrations/001_init.sql` → **Run**.
   - Then a new query with `supabase/migrations/002_extras.sql` → **Run** (bookings, packing lists, packing templates).
   - This creates every table, row-level security, the two **private** storage buckets (`photos`, `documents`) and their storage policies.
3. **In Supabase Auth: create your user, and turn off "Allow new users to sign up".**
   - **Authentication → Users → Add user → Create new user**: your email + a password, tick **Auto Confirm User**.
   - **Authentication → Sign In / Providers** (older dashboards: **Authentication → Settings**) → turn **off** "Allow new users to sign up" → **Save**.
4. **`npm install && npm run dev`. Then deploy to Vercel with the same two env vars.**
   - Open http://localhost:3000 and sign in. A welcome dialog asks for your name and base currency.
   - To see everything filled in: **Settings → Load sample data** (and **Delete sample data** when done).
   - Deploy: see [Deploy to Vercel](#deploy-to-vercel).

Until the two env vars exist, the app shows a friendly **Setup required** screen instead of crashing.

---

## Share links

Everything is private until you share one memory, trip story or year recap. Open **Share** on a memory, a trip's menu or a recap, pick the options and copy the link. Links default to 30 days, city-level locations and all photos.

**Setup (once):** add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API) to `.env.local` and to Vercel's environment variables as a server-only secret. Without it the app runs normally and the Share dialog says sharing is off.

**Revoke:** Settings → Share links, or the Share dialog. It takes effect on the next request, including for photos.

**What a visitor can get:** only what the page shows. Budget, expenses, cash, documents, entry and visa data, private notes, your home and settings have no field in the public view at all, so they can't appear even by mistake. With exact locations off, the map shows cities rounded to about 11 km and no place names. The map is drawn on the server, so the page holds no coordinates either way. Photos are streamed through `/s/[token]/photo/[id]`, which checks the link and that the photo belongs to it on every request; no signed URL is exposed. Unknown, revoked and expired links all give the same plain 404.

## Lost your authenticator?

If two-factor login locks you out, remove the factor as the project owner, then sign in with your password and set it up again. Either way works:

- **Supabase SQL editor:** `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'you@example.com');`
- **Admin API (server only, service role key):** `await supabase.auth.admin.mfa.deleteFactor({ id: factorId, userId })`

A forgotten PIN needs no recovery: Settings → Security → Change PIN asks for your account password instead of the old PIN.

## Run locally

```bash
npm install
npm run dev
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`, `npx tsc --noEmit`.

### Optional: fully local Supabase (Docker)

The repo includes the Supabase CLI as a dev dependency.

```bash
npx supabase start          # starts Postgres, Auth, Storage, REST locally
npx supabase db reset       # applies supabase/migrations/*.sql
```

`supabase start` prints a local API URL and anon key; put those in `.env.local`. Create a user in the local Studio (http://127.0.0.1:54323) or with the Auth admin API. If image pulls from `ghcr.io` are blocked on your network, prefix the start command with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`.

## Deploy to Vercel

1. Push this repository to GitHub (already done if you are reading this there).
2. [vercel.com/new](https://vercel.com/new) → **Import** the repository. Framework preset: **Next.js** (auto-detected). Leave build settings as they are.
3. Under **Environment Variables** add exactly:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Click **Deploy**. Open the deployment URL on your phone and sign in.
5. Optional but recommended: in Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel URL.
6. Install on your phone: Safari → Share → **Add to Home Screen** (iOS) or Chrome → **Install app** (Android).

CLI alternative: `npx vercel` (link the project), `npx vercel env add NEXT_PUBLIC_SUPABASE_URL`, `npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY`, then `npx vercel --prod`.

---

## What's inside

**Phase 1**
- **Dashboard** — greeting, next-stop hero with countdown (or "Day 5 of 10 in Italy"), count-up stat tiles, compact world map with animated great-circle route arcs, up next, budget snapshot donut, heads-up alerts (expiring documents, passport validity, undated countries, over-budget countries), recent memories, quick actions.
- **World map** — custom SVG (d3-geo `geoNaturalEarth1`, d3-zoom), status fills, hover tooltip, click to open or "Add to trip", numbered route, city dots when zoomed in, layer toggles, route panel (bottom sheet on mobile).
- **Trips** — cover cards, trip page with progress, *Next steps* checklist, route timeline date bar + drag-to-reorder list, stats, budget and memories shortcuts.
- **Countries** — bulk add (searchable list of ~250 countries with flags), filters (status, continent, trip), search, sort, drag reorder; country page with Overview, Cities, Itinerary, Places, Budget, Memories, Documents and Notes tabs.
- **Cities** — search-as-you-type (Photon, Nominatim fallback) multi-select, auto pin + auto cover; city page with places list/map, days here, memories, notes.
- **Places** — card / table / map views, filters, mark visited, right-side detail drawer (bottom sheet on mobile) with photos, rating, status, map, itinerary links.
- **Itinerary** — generate days from dates (never deletes days with content), quick add ("10:00 Senso-ji temple" parses time and type, auto-links a matching place), drag stops within and between days, duplicate / move / delete days, create place from a stop, day map with numbered markers and polyline.
- **Budget** — fast add sheet (Enter saves and stays open, live "≈ $12.40"), automatic FX rates with manual override, summary cards, donut / grouped bars / cumulative line charts, country caps, sortable/filterable table with inline edit, CSV export.
- **Memories** — composer with markdown, mood, tags and drag-and-drop multi-photo upload; timeline (by month), masonry gallery with lightbox, map.
- **Documents** — private uploads (PDF, JPG, PNG, HEIC, DOCX up to 25 MB), grouped by type, preview modal and download via 5-minute signed URLs, expiry chips, passport 6-month rule.
- **Settings** — display name, base currency (converts all expenses), theme, JSON + CSV export, JSON import, sample data load/delete, sign out.

**Phase 2**
- Command palette (Ctrl/Cmd+K): search everything, quick actions, navigation.
- Bookings (flights, trains, stays…) shown inside the itinerary on their dates, with confirmation numbers, linked documents and "also add as expense".
- Packing lists per trip with built-in templates, saved templates and "copy from another trip".
- Memories map tab (photo GPS, else linked place/city) and EXIF-based "photo taken near X — link it?" suggestion.
- Cover picker with up to 8 Wikimedia Commons candidates.
- Travel stats (continents, % of world, longest trip, most visited, spend per day).
- Printable itinerary (print stylesheet → Save as PDF).
- JSON import, "On this day" memories widget, PWA (manifest, icons, service worker).

## Project structure

```
app/(auth)/login           sign-in page (no sign-up)
app/(app)/...              all signed-in pages (layout = sidebar, top bar, trip switcher)
app/api/geocode|cover|fx   server routes (zod-validated, https allow-list, no open proxy)
app/api/export|import      data portability
actions/                   server actions per module (each calls supabase.auth.getUser())
components/                ui/, shell/, forms/, map/, charts/, photos/, and one folder per module
lib/                       supabase clients, countries, dates, money, fx, status, data loaders, config (APP_NAME)
supabase/migrations/       001_init.sql (Phase 1) and 002_extras.sql (Phase 2)
proxy.ts                   Next 16 "proxy" (formerly middleware): session refresh + redirect to /login
```

---

## Decisions

- **Next.js 16 with Cache Components turned off.** The scaffold enables `cacheComponents`; every page here is private and per-request (cookies + Supabase session), so the classic dynamic model is simpler and avoids Suspense-boundary build errors. `middleware.ts` is named `proxy.ts`, as Next 16 requires.
- **shadcn/ui components are written by hand** (same Radix + cva + tailwind-merge approach) because the shadcn registry was unreachable from the build environment. They live in `components/ui`.
- **Muted text colour is `#61656E`** instead of `#6B6F78`: the original was just under WCAG AA (4.45:1) on the warm paper background. Primary buttons use a deeper vermilion (`#C9421F`, white text) in light mode and `#FF6B45` with dark text in dark mode, so button labels pass AA; `#E8532F` stays the accent for highlights, rings and arcs.
- **Status chips always carry an icon and a label** (never colour alone). "Ongoing" is derived from dates and never stored.
- **Map colours across trips:** a country is shown with its strongest status across all trips (visited > planned > wishlist); routes, city dots and click-through follow the active trip filter.
- **Places require a city** (`city_id not null`) so every place belongs to a trip through its city; "Create place from this stop" uses the day's city, else the country's first city.
- **Memories and expenses belong to a trip** (`trip_id not null`, cascade). Documents can be global (e.g. passport) and have `is_sample` so sample documents can be deleted cleanly.
- **Packing templates**: built-in templates live in code; your own are saved in a small `packing_templates` table in `002_extras.sql` (not in the original spec, added for "reusable templates").
- **Auto covers** run from the browser right after creating a country, city or place (`POST /api/cover`, two at a time), then the page refreshes. Countries try "Tourism in {country}", then the capital; places try "{name}, {city}", then "{name}"; flags/locator maps are skipped. Images are resized to WebP with `sharp` and stored with a `photos` row (`source = wikimedia`) and attribution (shown via the ⓘ button on covers and in the lightbox).
- **Exchange rates**: `amount_base = amount × fx_rate`, where `fx_rate` converts 1 unit of the expense currency into the base currency. Rates come from open.er-api.com (cached 24 h). Fallback order: in-memory last known rates → a bundled approximate snapshot (labelled "approximate" in the UI) → manual rate. Changing the base currency in Settings re-converts all expenses.
- **Uploads go straight from the browser to private Storage**; Storage policies require the first path segment to equal `auth.uid()`. Server actions then save rows and double-check the path prefix. Photos are compressed in the browser (1920 px WebP ≈ 0.82 quality, plus a 480 px thumbnail).
- **Signed URLs** are created server-side in batches (1 hour for photos, 5 minutes for documents) and never logged.
- **"Move a day"** swaps the day's position (number and date) with the target day, so contents travel together. Deleting a day renumbers the rest.
- **Destructive actions** use a confirmation dialog; inside drawers/dialogs an inline "click again to confirm" button is used instead, to avoid a modal inside a modal.
- **Top bar title** fades in once the page's own large heading scrolls away (to avoid showing the same title twice).
- **Verification** was done against a real local Supabase (Docker) with Playwright screenshots at 1440 px and 390 px in light and dark mode, so the optional `/dev/preview` fixture route from the brief was not needed.
- **JSON import** adds everything as new rows with remapped ids; nothing is overwritten.
- **Flags render the same everywhere.** Windows has no flag emoji (Chrome and Edge show "TR", "IT"…), so the app self-hosts the small *Twemoji Country Flags* font (`app/fonts/`, Twemoji art under CC-BY-4.0, code MIT) and puts it first in the font stack with a `unicode-range` limited to flag code points. Only flags use it; all other text stays Geist/Fraunces.
- **Climate verdict order and the "Freezing" threshold differ from the brief.** Checked against real Open-Meteo normals for 2021-2025, the brief's order and its "average low ≤ 0 °C = Freezing" contradict its own examples: Bangkok in July (31.7 °C, 28 wet days) would read "Hot" instead of "Rainy season", and Reykjavik in January (low −3.3 °C, 18 wet days) "Freezing" instead of "Cold". So the first match now runs Very hot → Freezing → Cold → Rainy season → Hot → Good, and Freezing starts at an average low of −5 °C. This also stops Tokyo in January (low −0.0 °C) reading "Freezing". All thresholds are constants in `lib/climate.ts`.
- **Weather loads in the browser, through `/api/climate` and `/api/forecast`.** An unreachable weather API can then never slow down or break a page; each card shows its own "Weather unavailable". Normals are cached for 30 days per location rounded to one decimal, forecasts for 3 hours, and failures are not cached.
- **Country facts live in `data/country-extras.json`, including the driving side.** The brief expects driving side and week start from `world-countries`, but that package has neither field, so driving side is in the bundled file and week start is left out. The file was written from general knowledge, not checked against an official source: anything unsure is `null` and shows "Add", the tab carries a "verify before you travel" banner, and your edits always win.
- **Cash: getting it is not an expense, spending it is.** A withdrawal or exchange only moves money into a wallet; just its fee becomes an expense (category `fees`). A cash expense creates one linked `spend` transaction and keeps it in step on edit and delete. A planned expense takes nothing out until it is marked as spent. The ATM charge entered is the amount before the fee, and the fee counts toward the effective rate. Spending in a currency with no wallet creates the wallet, and an exchange into one does too. Wallets are per user, not per trip, because the cash in my pocket doesn't belong to a trip; a fee needs a trip because every expense does.
- **Receipts are `photos` rows with `entity_type = 'expense'`,** on the same private bucket and signed URLs, but their own preset (2000 px, quality 0.85, 400 px thumbnail, capped at 450 KB, no cropping) and without GPS, since a receipt's location adds nothing and shouldn't be stored. They don't count as photos in stats. The ZIP is built in the browser from fresh signed URLs, one file at a time, and a failed file is reported instead of losing the archive.
- **Photo pins resolve a location per photo:** its own GPS, else its linked place, else its linked city. Only your own uploads are pinned; Wikimedia covers and receipts stay out. Clicking a cluster shows its photos instead of zooming (a "Zoom in" button does that), so a pile of photos in one spot can be opened directly. A memory with no photos keeps a marker where it happened, as before. The world map's Photos layer counts a GPS photo with no linked city toward a trip city within 100 km; farther than that it isn't counted, rather than guessed.
- **Two-factor login is enforced in the database, not only in the proxy.** The brief asks for the proxy to require `aal2`, but the anon key is public, so someone with a leaked password could skip the app and call the API directly. Migration 004 adds a restrictive policy to every table and to the two storage buckets: once a factor is verified, an `aal1` session sees no rows and no files. The proxy still handles the redirect to the code step.
- **The PIN's secrets stay in the database.** The migration 003 functions gave the hash to the signed-in browser role, where a 4-digit PIN could be brute-forced offline, and let that role reset the attempt counter. Migration 004 replaces them: the server hashes an attempt with scrypt and the database compares it, counts failures and applies the 5-minute lockout. Setting the PIN needs a session whose password was entered in the last two minutes (the JWT's `amr` claim), obtained from a separate throwaway session so a two-factor session isn't downgraded.
- **The vault cookie holds a random token instead of a signed expiry.** The brief asks for a signed cookie, which would need a new secret to manage. The `httpOnly`, `secure`, `sameSite=strict` cookie `vault_unlocked` holds a token whose hash and expiry are in the database, so no secret is needed, the timeout slides on each check and Lock now takes effect at once. The server masks a locked document before sending it (reference `•••• 1234`, no notes, no file), including in the JSON export, and a storage policy stops a locked file being signed even by a direct API call.
- **Map export draws an SVG, then a canvas.** The live preview is the SVG that gets exported, with its Fraunces and Geist files embedded as data URLs so the text looks the same outside the page. "% of the world" is visited countries out of the 195 UN-recognised ones (193 members plus two observers), the same on the Stats page; territories such as Hong Kong appear on the map but don't count. The long side is capped at 4096 px, shrinking evenly instead of cropping, so 3x can come out smaller than a true 3x.
- **Recap slides are SVG, on screen and in the download,** so the 1080×1920 PNG is exactly what you see. Only things that already happened count: a stay's days up to today, spent (not planned) expenses, past memories and photos. Wishlist stays never count. Distance is the sum of straight lines between stops in the year, labelled approximate. A slide with no data is skipped. "On this day" looks across all trips, since last year's memories belong to a different trip than the active one.
- **The service role key appears in one place only.** `lib/supabase/admin.ts` is imported only by the public share code. Every query there is scoped by the share's owner, and each public view is built field by field in `lib/share.ts`, so a new column can't reach a visitor by accident. A recap's money is left out by that same builder.
- **View counts are set by the proxy.** It marks real GET page loads with a request header, stripping any sent by the visitor, and leaves out bots, link previews, prefetches and "Preview as visitor". No IP is stored; the rate limit keeps counts in memory only, per server instance, so on Vercel it is best effort.
- **Map tiles come from OpenStreetMap, not CARTO.** CARTO's basemap server now answers with "API key required" watermark tiles, so Leaflet maps use `tile.openstreetmap.org` (no key) and restyle it with CSS filters: softened and warm in light mode, inverted in dark mode. The URL and attribution live in `lib/config.ts` (`MAP_TILE_URL`) if you ever want another provider. OSM's tile policy is fine for a single-user personal app.

## Known limitations

- **PIN vault against a signed-in browser:** someone with developer tools on an already signed-in session can't open a locked file, reset the PIN or read its hash, but could read the `reference_no` and `notes` columns of a locked document through the API, because row security works per row, not per column. The app never shows or sends them while locked.
- **Unlocking is per account, not per device, on the database side.** The cookie is per browser and only that browser sees the documents as open, but the storage check looks at the account, so another signed-in browser could sign a file through a direct API call while the vault is open elsewhere.
- **JSON import** restores trips and everything under them, but not cash wallets, entry requirements or country overrides (they are in the export, but importing them could collide with what you already have). Imported cash expenses keep "cash" as their payment method without a wallet.
- Photo and document **files are not included in the JSON export/import** (metadata only); covers and attachments must be re-added after an import.
- External services (Photon, Wikipedia/Wikimedia, open.er-api, map tiles) were **not reachable from the build sandbox**, so live lookups were exercised only through their fallbacks there (gradient covers, "type a name", approximate FX snapshot, blank map tiles). They work normally on Vercel and on your machine.
- The service worker only caches static assets; Atlas needs a connection for data (offline sync is out of scope).
- Climate data comes from Open-Meteo's reanalysis archive, which counts drizzle generously: "wet days" run high in humid places (Bangkok in July shows 28), so "Rainy season" can appear a little more often than a local would say. The free Open-Meteo API is for non-commercial use and rate-limited per IP; shared Vercel IPs may occasionally hit that limit, which shows as "Weather unavailable".
- HEIC documents are stored and downloadable but most browsers cannot preview them inline.
