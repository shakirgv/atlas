# Atlas — personal travel dashboard

A private, single-user app for planning and tracking a trip around the world: countries, cities, itineraries, places, budget, memories and documents in one place.

Built with Next.js 16 (App Router, React 19, TypeScript strict), Tailwind CSS v4, Supabase (Postgres, Auth, Storage), d3-geo, Leaflet + CARTO and Recharts.

---

## What you must do manually

1. **Create a Supabase project** at [supabase.com](https://supabase.com) → *New project*. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key into `.env.local` (copy `.env.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   Never put the service-role key in this app.
2. **Run the SQL**: Supabase dashboard → **SQL Editor** → *New query* → paste the whole of `supabase/migrations/001_init.sql` → **Run**. Then do the same with `supabase/migrations/002_extras.sql`.
3. **Create your user**: **Authentication → Users → Add user → Create new user** (email + password, tick *Auto Confirm User*). Then **Authentication → Sign In / Providers** (or *Settings*) → turn off **Allow new users to sign up** → Save.
4. **Run it**: `npm install && npm run dev`, open http://localhost:3000, sign in. Then deploy to Vercel with the same two env vars (see below).

Until the two env vars exist, the app shows a friendly **Setup required** screen instead of crashing.
