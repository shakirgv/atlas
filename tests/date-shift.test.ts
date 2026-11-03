import { describe, expect, it } from "vitest";
import { planDateShift, shiftChanges, shiftLabel, type ShiftData, type ShiftInput } from "@/lib/date-shift";

const country = (id: string, order_index: number, arrive_date: string | null, depart_date: string | null, status = "planned") => ({ id, name: id, flag: "🏳️", order_index, status, arrive_date, depart_date });
const city = (id: string, trip_country_id: string, order_index: number, arrive_date: string | null, depart_date: string | null) => ({ id, trip_country_id, name: id, order_index, arrive_date, depart_date });
const day = (id: string, trip_country_id: string, day_number: number, date: string | null, city_id: string | null = null, stops = 1) => ({ id, trip_country_id, city_id, day_number, date, title: null, stops });
const booking = (id: string, type: string, start_at: string | null, end_at: string | null, link: { trip_country_id?: string; city_id?: string } = {}, status = "booked") => ({ id, type, title: id, status, trip_country_id: link.trip_country_id ?? null, city_id: link.city_id ?? null, start_at, end_at });

const data: ShiftData = {
  trip: { id: "trip", title: "World", start_date: "2027-05-01", end_date: "2027-05-30" },
  countries: [country("AZ", 0, "2027-05-01", "2027-05-10"), country("GE", 1, "2027-05-10", "2027-05-20"), country("TR", 2, "2027-05-20", "2027-05-30"), country("Later", 3, null, null)],
  cities: [city("Baku", "AZ", 0, "2027-05-01", "2027-05-06"), city("Sheki", "AZ", 1, "2027-05-06", "2027-05-10"), city("Tbilisi", "GE", 0, "2027-05-10", "2027-05-20"), city("Undated", "GE", 1, null, null), city("Istanbul", "TR", 0, "2027-05-20", "2027-05-30")],
  days: [day("az1", "AZ", 1, "2027-05-01", "Baku"), day("az9", "AZ", 9, "2027-05-09", "Sheki"), day("ge1", "GE", 1, "2027-05-11", "Tbilisi", 3), day("ge2", "GE", 2, null), day("tr1", "TR", 1, "2027-05-21", "Istanbul", 2)],
  bookings: [],
};
const input = (over: Partial<ShiftInput> = {}): ShiftInput => ({ mode: "extend", countryId: "AZ", cityId: null, days: 3, moveBookingIds: [], ...over });
const byId = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe("a longer stay (the brief: three more days in Azerbaijan)", () => {
  const plan = planDateShift(data, input());

  it("ends this stay three days later and keeps its start", () => {
    const az = byId(plan.countries, "AZ");
    expect([az.start_after, az.end_after]).toEqual(["2027-05-01", "2027-05-13"]);
    expect(byId(az.cities, "Sheki")).toMatchObject({ start_after: "2027-05-06", end_after: "2027-05-13" });
    expect(az.cities.map((c) => c.id)).toEqual(["Sheki"]);
    expect(az.days).toEqual([]);
  });

  it("moves later countries and their cities together", () => {
    const ge = byId(plan.countries, "GE");
    expect([ge.start_after, ge.end_after]).toEqual(["2027-05-13", "2027-05-23"]);
    expect(ge.cities.map((c) => [c.id, c.start_after, c.end_after])).toEqual([["Tbilisi", "2027-05-13", "2027-05-23"]]);
    expect(byId(plan.countries, "TR").end_after).toBe("2027-06-02");
  });

  it("moves day contents to their new dates and leaves undated days alone", () => {
    const ge = byId(plan.countries, "GE");
    expect(ge.days).toEqual([{ id: "ge1", trip_country_id: "GE", name: "Day 1", stops: 3, before: "2027-05-11", after: "2027-05-14" }]);
    expect(plan.counts).toEqual({ countries: 3, cities: 3, days: 2, stops: 5, bookings: 0 });
  });

  it("moves the trip's end date, not its start", () => {
    expect(plan.trip).toEqual({ start_before: "2027-05-01", end_before: "2027-05-30", start_after: "2027-05-01", end_after: "2027-06-02" });
  });

  it("reports what it left alone and the days it didn't create", () => {
    expect(plan.skipped.undated).toEqual(["Later"]);
    expect(plan.newDays).toBe(3);
    expect(plan.label).toBe("+3 days from AZ");
  });
});

describe("a shorter stay", () => {
  it("moves everything earlier and keeps stranded days with their content", () => {
    const plan = planDateShift(data, input({ days: -2 }));
    expect(byId(plan.countries, "AZ").end_after).toBe("2027-05-08");
    expect(byId(plan.countries, "GE").start_after).toBe("2027-05-08");
    expect(plan.stranded).toEqual([{ name: "Day 9", date: "2027-05-09", stops: 1 }]);
    expect(byId(plan.countries, "AZ").days).toEqual([]);
    expect(plan.newDays).toBe(0);
  });

  it("refuses a stay that would end before it starts", () => {
    expect(planDateShift(data, input({ days: -30 })).error).toMatch(/end before it starts/);
  });
});

describe("the whole stop moves", () => {
  it("moves the anchor too, with its days, and the trip's start when it is first", () => {
    const plan = planDateShift(data, input({ mode: "move", days: 2 }));
    const az = byId(plan.countries, "AZ");
    expect([az.start_after, az.end_after]).toEqual(["2027-05-03", "2027-05-12"]);
    expect(az.days.map((d) => d.after)).toEqual(["2027-05-03", "2027-05-11"]);
    expect(plan.trip).toMatchObject({ start_after: "2027-05-03", end_after: "2027-06-01" });
  });

  it("leaves earlier countries out", () => {
    const plan = planDateShift(data, input({ mode: "move", countryId: "GE", days: 2 }));
    expect(plan.countries.map((c) => c.id)).toEqual(["GE", "TR"]);
    expect(plan.trip).toMatchObject({ start_after: "2027-05-01", end_after: "2027-06-01" });
  });
});

describe("starting from a city", () => {
  it("a longer stay in one city moves the cities after it, not the ones before", () => {
    const plan = planDateShift(data, input({ cityId: "Baku", days: 2 }));
    const az = byId(plan.countries, "AZ");
    expect(byId(az.cities, "Baku")).toMatchObject({ start_after: "2027-05-01", end_after: "2027-05-08" });
    expect(byId(az.cities, "Sheki")).toMatchObject({ start_after: "2027-05-08", end_after: "2027-05-12" });
    expect([az.start_after, az.end_after]).toEqual(["2027-05-01", "2027-05-12"]);
    expect(az.days.map((d) => d.id)).toEqual(["az9"]);
  });

  it("moving a later city leaves the country's start and earlier days alone", () => {
    const plan = planDateShift(data, input({ mode: "move", cityId: "Sheki", days: 1 }));
    const az = byId(plan.countries, "AZ");
    expect(az.cities.map((c) => c.id)).toEqual(["Sheki"]);
    expect([az.start_after, az.end_after]).toEqual(["2027-05-01", "2027-05-11"]);
    expect(az.days.map((d) => d.id)).toEqual(["az9"]);
  });

  it("refuses a city from another country", () => {
    expect(planDateShift(data, input({ cityId: "Tbilisi" })).error).toMatch(/city in this country/);
  });
});

describe("what it won't touch", () => {
  it("skips a later country already visited", () => {
    const visited = { ...data, countries: data.countries.map((c) => (c.id === "GE" ? { ...c, status: "visited" } : c)) };
    const plan = planDateShift(visited, input());
    expect(plan.countries.map((c) => c.id)).toEqual(["AZ", "TR"]);
    expect(plan.skipped.visited).toEqual(["GE"]);
  });

  it("needs a departure date for a longer stay, and dates for a move", () => {
    const undated = { ...data, countries: data.countries.map((c) => (c.id === "AZ" ? { ...c, arrive_date: null, depart_date: null } : c)) };
    expect(planDateShift(undated, input()).error).toMatch(/departure date/);
    expect(planDateShift(undated, input({ mode: "move" })).error).toMatch(/Set dates/);
  });

  it("plans nothing for zero days and rejects nonsense", () => {
    const zero = planDateShift(data, input({ days: 0 }));
    expect([zero.error, zero.countries]).toEqual([null, []]);
    expect(planDateShift(data, input({ days: 1.5 })).error).toBeTruthy();
    expect(planDateShift(data, input({ days: 5000 })).error).toBeTruthy();
    expect(planDateShift(data, input({ countryId: "nope" })).error).toBeTruthy();
  });
});

describe("fixed bookings", () => {
  const withBookings = (...bookings: ShiftData["bookings"]) => ({ ...data, bookings });

  it("stay where they are and say what no longer fits", () => {
    const plan = planDateShift(
      withBookings(
        booking("flight-out", "flight", "2027-05-10T09:00:00+00:00", null, { trip_country_id: "AZ" }),
        booking("hotel-ge", "hotel", "2027-05-10T14:00:00+00:00", "2027-05-15T10:00:00+00:00", { city_id: "Tbilisi" }),
        booking("hotel-az", "hotel", "2027-05-06T14:00:00+00:00", "2027-05-10T10:00:00+00:00", { city_id: "Sheki" }),
        booking("fine", "tour", "2027-05-25T09:00:00+00:00", null, { trip_country_id: "TR" }),
      ),
      input(),
    );
    const of = (id: string) => plan.bookings.find((b) => b.booking.id === id)!;
    expect(of("flight-out").conflict).toMatch(/old last day in AZ/);
    expect(of("hotel-ge").conflict).toMatch(/Outside your new dates for Tbilisi/);
    expect(of("hotel-az").conflict).toMatch(/Ends before you leave Sheki/);
    expect(of("fine").conflict).toBeNull();
    expect(plan.bookings.every((b) => !b.move && b.start_after === b.booking.start_at)).toBe(true);
    expect(plan.bookings.at(-1)!.booking.id).toBe("fine");
  });

  it("move only when ticked, keeping the time of day", () => {
    const plan = planDateShift(withBookings(booking("b", "flight", "2027-05-11T09:30:00+00:00", "2027-05-11T12:00:00+00:00", { trip_country_id: "GE" })), input({ moveBookingIds: ["b"] }));
    expect(plan.bookings[0]).toMatchObject({ move: true, conflict: null, start_after: "2027-05-14T09:30:00.000Z", end_after: "2027-05-14T12:00:00.000Z" });
    expect(plan.counts.bookings).toBe(1);
  });

  it("ignores cancelled ones, undated ones and anything before what moves", () => {
    const plan = planDateShift(
      withBookings(booking("cancelled", "flight", "2027-05-11T09:00:00+00:00", null, { trip_country_id: "GE" }, "cancelled"), booking("undated", "hotel", null, null, { trip_country_id: "GE" }), booking("early", "tour", "2027-04-20T09:00:00+00:00", null)),
      input(),
    );
    expect(plan.bookings).toEqual([]);
  });
});

describe("what gets saved", () => {
  it("has the before and after of every changed row and nothing else", () => {
    const flights = [booking("b", "flight", "2027-05-11T09:30:00+00:00", null, { trip_country_id: "GE" }), booking("left", "flight", "2027-05-11T09:30:00+00:00", null, { trip_country_id: "GE" })];
    const changes = shiftChanges(planDateShift({ ...data, bookings: flights }, input({ moveBookingIds: ["b"] })), "trip");
    expect(changes.trips).toEqual([{ id: "trip", start_before: "2027-05-01", end_before: "2027-05-30", start_after: "2027-05-01", end_after: "2027-06-02" }]);
    expect(changes.countries.map((c) => c.id)).toEqual(["AZ", "GE", "TR"]);
    expect(changes.cities.map((c) => c.id)).toEqual(["Sheki", "Tbilisi", "Istanbul"]);
    expect(changes.days).toEqual([
      { id: "ge1", start_before: "2027-05-11", start_after: "2027-05-14" },
      { id: "tr1", start_before: "2027-05-21", start_after: "2027-05-24" },
    ]);
    expect(changes.bookings.map((b) => b.id)).toEqual(["b"]);
  });

  it("labels the shift both ways", () => {
    expect(shiftLabel(1, "Baku")).toBe("+1 day from Baku");
    expect(shiftLabel(-3, "Baku")).toBe("−3 days from Baku");
  });
});
