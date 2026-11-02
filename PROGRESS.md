# Feature pack 2 — progress (handoff file)

Work follows `IMPROVEMENTS.md` (feature pack 2). Branch: `claude/jolly-lamport-8vjpq6`.
Delete this file when the whole pack is finished.

## Done
- **Foundations** (committed): `supabase/migrations/003_improvements.sql` (all new tables/columns, RLS;
  PIN hash/salt live in a locked `vault_secrets` table instead of `settings`, reachable only through the
  `atlas_pin_state` / `atlas_pin_write` security-definer functions), regenerated `lib/database.types.ts`,
  `lib/timezones.ts`, `lib/server/tz-lookup.ts`, `lib/jetlag.ts`, `lib/geo.ts`, `lib/transport.ts`,
  `lib/route.ts`, `lib/server/backfill.ts` (auto time zone backfill in the app layout),
  Settings → "Home & passport", dashboard setup banner, Vitest (`npm test`, `tests/jetlag.test.ts`).

## Done: 3.6 Transport icons + 3.3 Time zones / jet lag
- World map: arc style per mode, midpoint icon badges, leg tooltip, flight plane glyph, home point, legend per mode.
- `lib/server/route-data.ts` (stops, legs, jet lag per trip), `components/route/transport-chip.tsx` (inline edit),
  `jetlag-chip.tsx`, `transport-field.tsx` (used in the country and city edit dialogs; the city dialog also has a time zone field).
- Trip route list: mode + jet lag chips between countries. Country header jet lag chip and Overview "Getting here" card.
- Map explorer: legend modes and a mode icon per country.
- Dashboard "Time" tile (`components/dashboard/time-tile.tsx`).

- Itinerary: soft banner on the arrival day when |shift| ≥ 6h. Sample data has flight, train and ferry legs.
- Map routes run stop by stop (`buildStops`), so legs between cities are drawn; only each country's first stop is numbered.

## Done: 3.2 Weather
- `lib/climate.ts` (verdicts, normals, WMO codes), `lib/server/weather.ts` (Open-Meteo + `unstable_cache`), `/api/climate`, `/api/forecast`,
  `hooks/use-climate.ts`, `components/climate/*`, dashboard `weather-tile.tsx`, `/dev/preview` fixture gallery (dev only).

## Done: 3.4 Country essentials
- `data/country-extras.json` (filled), `lib/country-info.ts`, `actions/country-info.ts`, `components/countries/essentials-tab.tsx`,
  `/countries/[id]/card` (`print-country-card.tsx`).

## Done: 3.1 Visa and entry
- `lib/entry.ts` (rules, starter checklist), `actions/entry.ts`, `components/entry/*`, Country tab "Entry", Documents tab "Visas & entry", Dashboard heads-up
  (plus a jet lag note). The Entry tab links documents with a plain `/documents?open=` link; 3.10 must gate it.

## Done: 3.8 Cash wallets
- `lib/cash.ts` (plans, tested), `lib/server/cash.ts`, `actions/cash.ts`, `components/cash/*`, Budget tab "Cash", expense form payment + wallet, dashboard cash rows.

## Done: 3.9 Receipts
- `lib/receipts.ts`, `components/budget/receipts.tsx`, expense table cell + filter + ZIP, expense form picker, `photos` preset in `lib/upload.ts`.

## Done: 3.7 Photo pins
- `lib/photo-pins.ts`, `lib/server/photo-pins.ts`, `components/photos/photo-map*.tsx`, Memories tab "Map", city mini-map, world map Photos layer, `setPhotoLocation`.

## Done: 3.10 MFA + PIN vault
- `supabase/migrations/004_extra_lock.sql`, `lib/vault*.ts`, `actions/vault.ts`, `actions/mfa.ts`, `components/vault/*`, `components/settings/security-section.tsx`, `/login/mfa`.
- The SQL was tested on PGlite (real Postgres, no Docker) with `auth` and `storage` stubbed; the Supabase Auth calls themselves were not run.

## Done: 3.5 Map export
- `lib/map-export.ts`, `lib/export-image.ts` (SVG → PNG pipeline, reused by recap), `components/map/export-map.tsx`, `export-dialog.tsx`.

## Next steps (build order from IMPROVEMENTS.md §5)
3.11 On this day + Recap → 3.12 Share links → polish/README/final report.

## Notes for a fresh session
- Dashboard bento needs rebalancing once Weather/Cash/On this day/Recap tiles exist (Time tile is in a `GlanceColumn`).
- The app runs on Vercel. Do NOT start Docker or a local Supabase for checks (the owner asked not to). Verify with
  tsc, lint, tests, build and a fixture-based `/dev/preview` route (disabled in production, still to be added).
- `IMPROVEMENTS.md` is not committed; the owner keeps a copy outside the repo.
