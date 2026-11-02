import { describe, expect, it } from "vitest";
import { adaptationDays, jetLag, jetLagLabel, severityFor, shiftHours } from "@/lib/jetlag";
import { buildLegs, buildStops } from "@/lib/route";

describe("jet lag shift", () => {
  it("Baku → Tokyo is +5h east", () => {
    const j = jetLag("Asia/Baku", "2026-04-10", "Asia/Tokyo", "2026-04-11")!;
    expect(j.shift).toBe(5);
    expect(j.direction).toBe("east");
    expect(j.severity).toBe("moderate");
    expect(jetLagLabel(j)).toBe("+5h east · ~5 days to adjust");
  });

  it("New York → Baku is +9h in winter (EST, UTC−5) and +8h in summer (EDT, UTC−4)", () => {
    expect(shiftHours("America/New_York", "2026-01-15", "Asia/Baku", "2026-01-16")).toBe(9);
    expect(shiftHours("America/New_York", "2026-07-15", "Asia/Baku", "2026-07-16")).toBe(8);
  });

  it("is DST-aware: London → New York differs around the March transition", () => {
    // US switches on 8 Mar 2026, UK on 29 Mar 2026: for three weeks the gap is 4h, not 5h.
    expect(shiftHours("Europe/London", "2026-03-01", "America/New_York", "2026-03-01")).toBe(-5);
    expect(shiftHours("Europe/London", "2026-03-15", "America/New_York", "2026-03-15")).toBe(-4);
  });

  it("handles half-hour zones", () => {
    expect(shiftHours("Asia/Baku", "2026-05-01", "Asia/Kolkata", "2026-05-01")).toBe(1.5);
    expect(shiftHours("Europe/Berlin", "2026-05-01", "Asia/Kathmandu", "2026-05-01")).toBe(3.75);
  });

  it("normalises big jumps into the shorter direction", () => {
    // Tokyo (+9) → Los Angeles (−7 in summer) is −16h, experienced as +8h east.
    expect(shiftHours("Asia/Tokyo", "2026-07-01", "America/Los_Angeles", "2026-07-01")).toBe(8);
  });

  it("zero shift has no severity", () => {
    const j = jetLag("Europe/Rome", "2026-05-01", "Europe/Berlin", "2026-05-01")!;
    expect(j.shift).toBe(0);
    expect(j.severity).toBe("none");
    expect(j.days).toBe(0);
  });
});

describe("adaptation heuristic", () => {
  it("east ≈ 1 day/hour, west ≈ 0.5 day/hour, rounded up, capped at 7", () => {
    expect(adaptationDays(5)).toBe(5);
    expect(adaptationDays(-5)).toBe(3);
    expect(adaptationDays(-3.5)).toBe(2);
    expect(adaptationDays(10)).toBe(7);
    expect(adaptationDays(-12)).toBe(6);
  });
  it("severity thresholds", () => {
    expect(severityFor(2.5)).toBe("none");
    expect(severityFor(3)).toBe("moderate");
    expect(severityFor(-5.5)).toBe("moderate");
    expect(severityFor(6)).toBe("strong");
  });
});

describe("route legs", () => {
  it("first leg comes from home; consecutive stops use departure/arrival dates", () => {
    const stops = buildStops(
      [
        { id: "tr", code: "TR", name: "Türkiye", order_index: 0, arrive_date: "2026-05-01", depart_date: "2026-05-05", transport_mode: "flight" },
        { id: "jp", code: "JP", name: "Japan", order_index: 1, arrive_date: "2026-05-06", depart_date: "2026-05-20", transport_mode: "flight" },
      ],
      [
        { id: "ist", trip_country_id: "tr", name: "Istanbul", order_index: 0, lat: 41, lng: 29, arrive_date: null, depart_date: null, timezone: "Europe/Istanbul" },
        { id: "tyo", trip_country_id: "jp", name: "Tokyo", order_index: 0, lat: 35.7, lng: 139.7, arrive_date: null, depart_date: null, timezone: "Asia/Tokyo", transport_mode: "train" },
      ],
    );
    expect(stops.map((s) => s.name)).toEqual(["Istanbul", "Tokyo"]);
    expect(stops[0]!.transport).toBe("flight");
    expect(stops[1]!.transport).toBe("train"); // city override wins
    const legs = buildLegs(stops, { key: "home", kind: "home", name: "Baku", lat: 40.4, lng: 49.9, tz: "Asia/Baku" });
    expect(legs).toHaveLength(2);
    expect(legs[0]!.jetlag!.shift).toBe(-1);
    expect(legs[1]!.jetlag!.shift).toBe(6);
  });
});
