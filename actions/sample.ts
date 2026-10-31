"use server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { cleanupTrips } from "@/lib/entities";
import { removeFiles } from "@/lib/storage";
import { getRates } from "@/lib/fx";
import { rateToBase, round2 } from "@/lib/money";
import { shiftIso, todayIso } from "@/lib/dates";
import { ACTIVE_TRIP_COOKIE } from "@/lib/config";
import { fail, must, mustMaybe, ok, refreshAll } from "@/actions/_util";
import type { ActionResult, ExpenseCategory, PlaceCategory, PlaceStatus, StopType } from "@/lib/types";

/** Rough USD-based rates used only if live rates are unavailable while seeding. */
const STATIC_PER_USD: Record<string, number> = { USD: 1, EUR: 0.92, TRY: 34.5, JPY: 150, GBP: 0.78, AZN: 1.7 };

type PlaceSeed = { key: string; city: string; name: string; category: PlaceCategory; lat: number; lng: number; status: PlaceStatus; rating?: number; address?: string; cost?: [number, string]; hours?: string };

const PLACES: PlaceSeed[] = [
  { key: "hagia", city: "istanbul", name: "Hagia Sophia", category: "sight", lat: 41.0086, lng: 28.9802, status: "visited", rating: 5, address: "Sultan Ahmet, Ayasofya Meydanı 1, Fatih", hours: "09:00–19:00" },
  { key: "topkapi", city: "istanbul", name: "Topkapı Palace", category: "museum", lat: 41.0115, lng: 28.9834, status: "visited", rating: 4, address: "Cankurtaran, Fatih", cost: [1700, "TRY"], hours: "09:00–18:00, closed Tue" },
  { key: "bazaar", city: "istanbul", name: "Grand Bazaar", category: "shopping", lat: 41.0107, lng: 28.9681, status: "visited", rating: 4, address: "Beyazıt, Fatih", hours: "08:30–19:00, closed Sun" },
  { key: "galata", city: "istanbul", name: "Galata Tower", category: "sight", lat: 41.0256, lng: 28.9744, status: "visited", rating: 4, address: "Bereketzade, Beyoğlu" },
  { key: "gulluoglu", city: "istanbul", name: "Karaköy Güllüoğlu", category: "food", lat: 41.0228, lng: 28.977, status: "visited", rating: 5, address: "Kemankeş Karamustafa Paşa, Beyoğlu" },
  { key: "colosseum", city: "rome", name: "Colosseum", category: "sight", lat: 41.8902, lng: 12.4922, status: "visited", rating: 5, address: "Piazza del Colosseo, 1", cost: [24, "EUR"], hours: "09:00–19:15" },
  { key: "pantheon", city: "rome", name: "Pantheon", category: "sight", lat: 41.8986, lng: 12.4769, status: "planned", address: "Piazza della Rotonda", cost: [5, "EUR"] },
  { key: "trevi", city: "rome", name: "Trevi Fountain", category: "sight", lat: 41.9009, lng: 12.4833, status: "planned", address: "Piazza di Trevi" },
  { key: "roscioli", city: "rome", name: "Roscioli", category: "food", lat: 41.8938, lng: 12.4741, status: "planned", address: "Via dei Giubbonari, 21", cost: [45, "EUR"] },
  { key: "vatican", city: "rome", name: "Vatican Museums", category: "museum", lat: 41.9065, lng: 12.4536, status: "planned", address: "Viale Vaticano", cost: [20, "EUR"], hours: "08:00–19:00, closed Sun" },
  { key: "uffizi", city: "florence", name: "Uffizi Gallery", category: "museum", lat: 43.7678, lng: 11.2553, status: "planned", address: "Piazzale degli Uffizi, 6", cost: [25, "EUR"] },
  { key: "michelangelo", city: "florence", name: "Piazzale Michelangelo", category: "nature", lat: 43.7629, lng: 11.265, status: "want" },
  { key: "sensoji", city: "tokyo", name: "Senso-ji", category: "sight", lat: 35.7148, lng: 139.7967, status: "want", address: "2-3-1 Asakusa, Taito City" },
  { key: "shibuya", city: "tokyo", name: "Shibuya Crossing", category: "sight", lat: 35.6595, lng: 139.7005, status: "want" },
  { key: "tsukiji", city: "tokyo", name: "Tsukiji Outer Market", category: "food", lat: 35.6654, lng: 139.7707, status: "want", hours: "05:00–14:00" },
  { key: "inari", city: "kyoto", name: "Fushimi Inari Taisha", category: "sight", lat: 34.9671, lng: 135.7727, status: "want" },
  { key: "arashiyama", city: "kyoto", name: "Arashiyama Bamboo Grove", category: "nature", lat: 35.017, lng: 135.6713, status: "want" },
];

export async function loadSampleData(): Promise<ActionResult<{ tripId: string }>> {
  try {
    const { supabase } = await requireUser();
    const existing = must(await supabase.from("trips").select("id").eq("is_sample", true).limit(1));
    if (existing.length) throw new Error("Sample data is already loaded.");

    const T = todayIso();
    const d = (n: number) => shiftIso(T, n);
    const settings = mustMaybe(await supabase.from("settings").select("base_currency").maybeSingle());
    const base = settings?.base_currency ?? "USD";
    const rates = await getRates(base);
    const fx = (cur: string) => {
      if (cur === base) return 1;
      const live = rateToBase(rates, cur);
      if (live) return live;
      const a = STATIC_PER_USD[base];
      const b = STATIC_PER_USD[cur];
      return a && b ? a / b : 1;
    };

    const trip = must(
      await supabase
        .from("trips")
        .insert({
          title: "Sample: Three Countries",
          description: "Istanbul's bazaars, Roman evenings and Kyoto's temples — a sample trip to explore Atlas.",
          status: "ongoing",
          start_date: d(-10),
          end_date: d(18),
          total_budget: round2(9000 * fx("USD")),
          is_sample: true,
        })
        .select("id")
        .single(),
    );

    const tcs = must(
      await supabase
        .from("trip_countries")
        .insert([
          { trip_id: trip.id, country_code: "TR", order_index: 0, status: "visited", arrive_date: d(-10), depart_date: d(-5), budget: round2(1500 * fx("USD")), notes: "Get an Istanbulkart on day one. Ferries are the best way to see the city." },
          { trip_id: trip.id, country_code: "IT", order_index: 1, status: "planned", arrive_date: d(-4), depart_date: d(5), budget: round2(2600 * fx("USD")), notes: "Book Vatican Museums in advance. Many churches need covered shoulders." },
          { trip_id: trip.id, country_code: "JP", order_index: 2, status: "planned", arrive_date: d(6), depart_date: d(18), budget: round2(4000 * fx("USD")), notes: "Activate the JR Pass at Haneda. Carry cash for small restaurants." },
        ])
        .select("id, country_code"),
    );
    const tc = (code: string) => tcs.find((t) => t.country_code.trim() === code)!.id;

    const cities = must(
      await supabase
        .from("cities")
        .insert([
          { trip_country_id: tc("TR"), name: "Istanbul", lat: 41.0082, lng: 28.9784, order_index: 0, status: "visited", arrive_date: d(-10), depart_date: d(-5) },
          { trip_country_id: tc("IT"), name: "Rome", lat: 41.9028, lng: 12.4964, order_index: 0, status: "planned", arrive_date: d(-4), depart_date: d(1) },
          { trip_country_id: tc("IT"), name: "Florence", lat: 43.7696, lng: 11.2558, order_index: 1, status: "planned", arrive_date: d(2), depart_date: d(5) },
          { trip_country_id: tc("JP"), name: "Tokyo", lat: 35.6762, lng: 139.6503, order_index: 0, status: "planned", arrive_date: d(6), depart_date: d(12) },
          { trip_country_id: tc("JP"), name: "Kyoto", lat: 35.0116, lng: 135.7681, order_index: 1, status: "planned", arrive_date: d(13), depart_date: d(18) },
        ])
        .select("id, name"),
    );
    const city = (name: string) => cities.find((c) => c.name.toLowerCase() === name)!.id;

    const places = must(
      await supabase
        .from("places")
        .insert(
          PLACES.map((p) => ({
            city_id: city(p.city),
            name: p.name,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            status: p.status,
            rating: p.rating ?? null,
            address: p.address ?? null,
            cost_estimate: p.cost?.[0] ?? null,
            cost_currency: p.cost?.[1] ?? null,
            opening_hours: p.hours ?? null,
          })),
        )
        .select("id, name"),
    );
    const place = (key: string) => {
      const name = PLACES.find((p) => p.key === key)!.name;
      return places.find((p) => p.name === name)!.id;
    };

    type DaySeed = { tc: string; n: number; date: string; city: string; title: string; stops: [string | null, string, StopType, string | null, boolean][] };
    const DAYS: DaySeed[] = [
      { tc: "TR", n: 1, date: d(-10), city: "istanbul", title: "The Old City", stops: [
        ["09:00", "Hagia Sophia", "activity", "hagia", true],
        ["11:30", "Topkapı Palace", "activity", "topkapi", true],
        ["13:30", "Lunch at Sultanahmet Köftecisi", "food", null, true],
        ["16:00", "Grand Bazaar", "activity", "bazaar", true],
      ] },
      { tc: "TR", n: 2, date: d(-9), city: "istanbul", title: "Bosphorus & Galata", stops: [
        ["10:00", "Bosphorus ferry to Kadıköy", "transport", null, true],
        ["13:00", "Baklava at Karaköy Güllüoğlu", "food", "gulluoglu", true],
        ["17:30", "Galata Tower at sunset", "activity", "galata", true],
      ] },
      { tc: "IT", n: 5, date: d(0), city: "rome", title: "Ancient Rome", stops: [
        ["09:00", "Colosseum & Roman Forum", "activity", "colosseum", true],
        ["13:00", "Lunch at Roscioli", "food", "roscioli", false],
        ["15:30", "Pantheon", "activity", "pantheon", false],
        ["19:00", "Trevi Fountain at dusk", "activity", "trevi", false],
      ] },
      { tc: "IT", n: 6, date: d(1), city: "rome", title: "Vatican day", stops: [
        ["08:30", "Vatican Museums & Sistine Chapel", "activity", "vatican", false],
        ["12:30", "St. Peter's Basilica dome climb", "activity", null, false],
        ["20:00", "Dinner in Trastevere", "food", null, false],
      ] },
      { tc: "JP", n: 1, date: d(6), city: "tokyo", title: "Arrival in Tokyo", stops: [
        ["07:40", "Land at Haneda, activate JR Pass", "transport", null, false],
        ["15:00", "Check in at Shinjuku hotel", "stay", null, false],
        ["18:00", "Shibuya Crossing & dinner", "activity", "shibuya", false],
      ] },
      { tc: "JP", n: 2, date: d(7), city: "tokyo", title: "Asakusa & Tsukiji", stops: [
        ["08:00", "Breakfast at Tsukiji Outer Market", "food", "tsukiji", false],
        ["10:00", "Senso-ji temple", "activity", "sensoji", false],
        ["14:00", "teamLab Planets", "activity", null, false],
      ] },
    ];
    const days = must(
      await supabase
        .from("itinerary_days")
        .insert(DAYS.map((x) => ({ trip_country_id: tc(x.tc), day_number: x.n, date: x.date, city_id: city(x.city), title: x.title })))
        .select("id, trip_country_id, day_number"),
    );
    const items = DAYS.flatMap((x) => {
      const dayId = days.find((r) => r.trip_country_id === tc(x.tc) && r.day_number === x.n)!.id;
      return x.stops.map(([time, title, type, pk, done], i) => ({
        day_id: dayId,
        title,
        type,
        start_time: time,
        place_id: pk ? place(pk) : null,
        done,
        order_index: i,
      }));
    });
    must(await supabase.from("itinerary_items").insert(items));

    type ExpSeed = [number, string, string, ExpenseCategory, "planned" | "actual", number, string | null, string | null];
    const EXP: ExpSeed[] = [
      [-25, "Japan eVisa", "USD", "visa", "actual", 25, "JP", null],
      [-20, "Travel insurance (4 weeks)", "USD", "insurance", "actual", 180, null, null],
      [-11, "Flight to Istanbul", "USD", "flights", "actual", 320, "TR", null],
      [-10, "Hotel in Sultanahmet (5 nights)", "TRY", "accommodation", "actual", 9800, "TR", "istanbul"],
      [-10, "Hagia Sophia & Topkapı tickets", "TRY", "activities", "actual", 1700, "TR", "istanbul"],
      [-10, "Istanbulkart top-up", "TRY", "transport", "actual", 420, "TR", "istanbul"],
      [-10, "Grand Bazaar ceramics", "TRY", "shopping", "actual", 2600, "TR", "istanbul"],
      [-9, "Dinner in Kadıköy", "TRY", "food", "actual", 1450, "TR", "istanbul"],
      [-5, "Flight Istanbul → Rome", "EUR", "flights", "actual", 145, "IT", null],
      [-4, "Apartment in Monti (6 nights)", "EUR", "accommodation", "actual", 780, "IT", "rome"],
      [-4, "Metro pass", "EUR", "transport", "actual", 35, "IT", "rome"],
      [-3, "Lunch at Roscioli", "EUR", "food", "actual", 62, "IT", "rome"],
      [-2, "Gelato & espresso", "EUR", "food", "actual", 28, "IT", "rome"],
      [0, "Colosseum + Forum tickets", "EUR", "activities", "actual", 44, "IT", "rome"],
      [2, "Train Rome → Florence", "EUR", "transport", "planned", 48, "IT", "florence"],
      [2, "Florence B&B (4 nights)", "EUR", "accommodation", "planned", 520, "IT", "florence"],
      [3, "Uffizi tickets", "EUR", "activities", "planned", 30, "IT", "florence"],
      [5, "Flight Rome → Tokyo", "USD", "flights", "planned", 890, "JP", null],
      [6, "Hotel in Shinjuku (7 nights)", "JPY", "accommodation", "planned", 168000, "JP", "tokyo"],
      [6, "JR Pass (7 days)", "JPY", "transport", "planned", 50000, "JP", "tokyo"],
      [6, "Food budget Tokyo", "JPY", "food", "planned", 45000, "JP", "tokyo"],
      [13, "Ryokan in Kyoto", "JPY", "accommodation", "planned", 120000, "JP", "kyoto"],
    ];
    must(
      await supabase.from("expenses").insert(
        EXP.map(([offset, title, cur, category, kind, amount, cc, cn]) => {
          const rate = fx(cur);
          return {
            trip_id: trip.id,
            trip_country_id: cc ? tc(cc) : null,
            city_id: cn ? city(cn) : null,
            date: d(offset),
            title,
            category,
            kind,
            amount,
            currency: cur,
            fx_rate: rate,
            amount_base: round2(amount * rate),
          };
        }),
      ),
    );

    must(
      await supabase.from("memories").insert([
        {
          trip_id: trip.id,
          trip_country_id: tc("TR"),
          city_id: city("istanbul"),
          date: d(-10),
          title: "First evening on the Bosphorus",
          body: "The call to prayer rolled across the water while the ferries kept crossing.\n\n**Note to self:** sit on the right side of the boat going to Kadıköy.",
          mood: "🌅",
          tags: ["istanbul", "sunset", "ferry"],
        },
        {
          trip_id: trip.id,
          trip_country_id: tc("TR"),
          city_id: city("istanbul"),
          place_id: place("gulluoglu"),
          date: d(-9),
          title: "Baklava at Karaköy",
          body: "Pistachio baklava, still warm. Ordered a second plate without thinking.",
          mood: "😋",
          tags: ["food", "istanbul"],
        },
        {
          trip_id: trip.id,
          trip_country_id: tc("IT"),
          city_id: city("rome"),
          date: d(-3),
          title: "Lost in Monti",
          body: "No map, just ivy walls, tiny wine bars and a cat that followed us for three streets.",
          mood: "✨",
          tags: ["rome", "walk"],
        },
      ]),
    );

    must(
      await supabase.from("documents").insert([
        { type: "passport", title: "Passport", reference_no: "C01234567", issue_date: d(-3500), expiry_date: d(150), notes: "Expires less than 6 months after this trip ends — renew soon.", is_sample: true },
        { type: "visa", title: "Japan eVisa", trip_id: trip.id, trip_country_id: tc("JP"), reference_no: "JPN-2026-0045", issue_date: d(-25), expiry_date: d(20), is_sample: true },
        { type: "insurance", title: "World travel insurance", trip_id: trip.id, reference_no: "WT-889120", issue_date: d(-20), expiry_date: d(75), notes: "Emergency line +44 20 0000 0000", is_sample: true },
      ]),
    );

    // Phase 2 tables are optional (002_extras.sql may not be applied yet).
    await supabase.from("bookings").insert([
      { trip_id: trip.id, trip_country_id: tc("IT"), city_id: city("florence"), type: "train", title: "Frecciarossa Rome → Florence", from_label: "Roma Termini", to_label: "Firenze S.M.N.", start_at: `${d(2)}T10:15:00`, end_at: `${d(2)}T11:51:00`, confirmation_no: "PNR 7XK2LM", cost: 48, currency: "EUR", status: "booked" },
      { trip_id: trip.id, trip_country_id: tc("JP"), city_id: city("tokyo"), type: "flight", title: "Rome → Tokyo Haneda", from_label: "FCO", to_label: "HND", start_at: `${d(5)}T13:20:00`, end_at: `${d(6)}T07:40:00`, confirmation_no: "QX4H8T", cost: 890, currency: "USD", status: "booked" },
      { trip_id: trip.id, trip_country_id: tc("JP"), city_id: city("kyoto"), type: "hotel", title: "Ryokan Yachiyo", from_label: null, to_label: "Kyoto", start_at: `${d(13)}T15:00:00`, end_at: `${d(18)}T11:00:00`, confirmation_no: "RY-20931", cost: 120000, currency: "JPY", status: "pending" },
    ]);
    await supabase.from("packing_items").insert(
      [
        ["Passport", "Documents", true],
        ["Travel insurance printout", "Documents", true],
        ["Universal adapter", "Tech", true],
        ["Power bank", "Tech", false],
        ["Rain jacket", "Clothes", false],
        ["Comfortable walking shoes", "Clothes", true],
        ["Sunscreen", "Toiletries", false],
        ["Yen in cash", "Money", false],
      ].map(([label, category, packed], i) => ({ trip_id: trip.id, label: label as string, category: category as string, packed: packed as boolean, order_index: i })),
    );

    (await cookies()).set(ACTIVE_TRIP_COOKIE, trip.id, { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
    refreshAll();
    return ok({ tripId: trip.id });
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSampleData(): Promise<ActionResult> {
  try {
    const { supabase } = await requireUser();
    const trips = must(await supabase.from("trips").select("id").eq("is_sample", true));
    const ids = trips.map((t) => t.id);
    if (ids.length) {
      await cleanupTrips(supabase, ids);
      must(await supabase.from("trips").delete().in("id", ids));
    }
    const docs = must(await supabase.from("documents").select("id, file_path").eq("is_sample", true));
    if (docs.length) {
      await removeFiles(supabase, "documents", docs.map((x) => x.file_path));
      must(await supabase.from("documents").delete().in("id", docs.map((x) => x.id)));
    }
    const store = await cookies();
    if (ids.includes(store.get(ACTIVE_TRIP_COOKIE)?.value ?? "")) store.delete(ACTIVE_TRIP_COOKIE);
    refreshAll();
    return ok();
  } catch (e) {
    return fail(e);
  }
}
