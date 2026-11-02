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

## In progress: 3.6 Transport icons + 3.3 Time zones / jet lag
Done so far (work in progress, compiles and lints):
- World map: arc style per mode, midpoint icon badges, leg tooltip, flight plane glyph, home point, legend per mode.
- `lib/server/route-data.ts` (stops, legs, jet lag per trip), `components/route/transport-chip.tsx` (inline edit),
  `jetlag-chip.tsx`, `transport-field.tsx` (used in the country and city edit dialogs; the city dialog also has a time zone field).
- Trip route list: mode + jet lag chips between countries. Country header jet lag chip and Overview "Getting here" card.
- Map explorer: legend modes and a mode icon per country.
- Dashboard "Time" tile (`components/dashboard/time-tile.tsx`).

Still to do for this step:
- Itinerary: soft banner on the arrival day when |shift| ≥ 6h ("Big time shift. Consider a light first day.").
  Plan: in `app/(app)/itinerary/page.tsx`, compute `tripRoute(...)` for the selected country's trip and pass the arrival
  dates of strong legs to the planner → `DayCard`.
- Sample data: add transport modes to the stops; then build, screenshot and commit.

## Next steps (build order from IMPROVEMENTS.md §5)
3.2 Weather → 3.4 Country essentials (`data/country-extras.json` is still an empty stub; `lib/country-extras.ts` is ready)
→ 3.1 Visa/entry → 3.8 Cash → 3.9 Receipts → 3.7 Photo pins → 3.10 MFA + PIN vault → 3.5 Map export
→ 3.11 On this day + Recap → 3.12 Share links → polish/README/final report.

## Notes for a fresh session
- Dashboard bento needs rebalancing once Weather/Cash/On this day/Recap tiles exist (Time tile is in a `GlanceColumn`).
- Local verification: `dockerd &`, then `npx supabase start -x studio,realtime,edge-runtime,logflare,vector,imgproxy,supavisor,mailpit,postgres-meta`
  (some image pulls can be rate-limited; retry). Dev user: me@atlas.test / atlas-dev-123 (create via the Auth admin API).
- `.env.local` is git-ignored; local keys come from the `supabase start` output.
