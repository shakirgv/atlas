import { describe, expect, it } from "vitest";
import { aggregateDaily, climateKey, isBestMonth, monthsInStay, verdictForMonth, verdictForStay, weatherFromCode, worstVerdict, type ClimateMonth } from "@/lib/climate";

const m = (month: number, tmax: number, tmin: number, precip = 20, wetDays = 3): ClimateMonth => ({ month, tmax, tmin, precip, wetDays });

// Real Open-Meteo normals for 2021-2025.
const BANGKOK_JULY = m(7, 31.7, 25.4, 255, 28);
const REYKJAVIK_JANUARY = m(1, 1.6, -3.3, 165, 17.8);
const TOKYO_JANUARY = m(1, 9.4, -0.0, 36, 4.4);
const OSLO_JANUARY = m(1, -1.2, -6.8, 77, 10.4);
const DUBAI_JULY = m(7, 40.7, 30.8, 5, 0.8);
const ROME_JULY = m(7, 34, 21.5, 18, 3.2);

describe("climate verdicts", () => {
  it("meets the spec's examples on real data", () => {
    expect(verdictForMonth(BANGKOK_JULY)).toBe("rainy");
    expect(verdictForMonth(REYKJAVIK_JANUARY)).toBe("cold");
  });

  it("covers the other verdicts", () => {
    expect(verdictForMonth(DUBAI_JULY)).toBe("very_hot");
    expect(verdictForMonth(OSLO_JANUARY)).toBe("freezing");
    expect(verdictForMonth(TOKYO_JANUARY)).toBe("cold");
    expect(verdictForMonth(ROME_JULY)).toBe("hot");
    expect(verdictForMonth(m(5, 24, 14))).toBe("good");
  });

  it("applies the thresholds at their edges", () => {
    expect(verdictForMonth(m(7, 35, 20))).toBe("very_hot");
    expect(verdictForMonth(m(7, 30, 20))).toBe("hot");
    expect(verdictForMonth(m(7, 29.9, 20))).toBe("good");
    expect(verdictForMonth(m(1, 10, 5))).toBe("cold");
    expect(verdictForMonth(m(1, 10, -5))).toBe("freezing");
    expect(verdictForMonth(m(5, 25, 15, 250, 2))).toBe("rainy");
    expect(verdictForMonth(m(5, 25, 15, 100, 15))).toBe("rainy");
  });

  it("marks best months", () => {
    expect(isBestMonth(m(5, 24, 14, 40, 6))).toBe(true);
    expect(isBestMonth(m(5, 24, 14, 40, 9))).toBe(false);
    expect(isBestMonth(m(4, 17, 8, 40, 6))).toBe(false);
  });
});

describe("stays", () => {
  const year = [m(1, 8, 1), m(2, 12, 6), m(3, 24, 14), m(11, 20, 10), m(12, 12, 6)];

  it("lists the months of a stay, across a new year too", () => {
    expect(monthsInStay("2027-03-14", "2027-05-02")).toEqual([3, 4, 5]);
    expect(monthsInStay("2026-11-20", "2027-01-10")).toEqual([11, 12, 1]);
    expect(monthsInStay("2027-03-14", null)).toEqual([3]);
    expect(monthsInStay(null, "2027-03-14")).toEqual([3]);
    expect(monthsInStay(null, null)).toEqual([]);
  });

  it("gives no verdict without dates", () => {
    expect(verdictForStay(year, null, null)).toBeNull();
  });

  it("uses the worst month of a longer stay", () => {
    const v = verdictForStay(year, "2027-01-20", "2027-03-05");
    expect(v?.verdict).toBe("cold");
    expect(v?.month.month).toBe(1);
  });

  it("picks the worst verdict across stops and skips stops without data", () => {
    const data = { [climateKey(13.8, 100.5)]: [BANGKOK_JULY], [climateKey(41.9, 12.5)]: [ROME_JULY] };
    const stops = [
      { name: "Rome", lat: 41.9, lng: 12.5, arrive: "2027-07-01", depart: "2027-07-05" },
      { name: "Bangkok", lat: 13.8, lng: 100.5, arrive: "2027-07-06", depart: "2027-07-10" },
      { name: "Unknown", lat: 1, lng: 1, arrive: "2027-07-11", depart: "2027-07-12" },
    ];
    const w = worstVerdict(stops, data);
    expect(w?.verdict).toBe("rainy");
    expect(w?.stop.name).toBe("Bangkok");
  });
});

describe("aggregateDaily", () => {
  const twoYears = () => {
    const time: string[] = [];
    const tmax: (number | null)[] = [];
    const tmin: (number | null)[] = [];
    const rain: (number | null)[] = [];
    for (const y of [2024, 2025]) {
      for (let month = 1; month <= 12; month++) {
        for (const day of [1, 2]) {
          time.push(`${y}-${String(month).padStart(2, "0")}-0${day}`);
          tmax.push(month + 10);
          tmin.push(month);
          rain.push(day === 1 ? 5 : 0.5);
        }
      }
    }
    return { time, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_sum: rain };
  };

  it("averages temperature and sums rain per year", () => {
    const out = aggregateDaily(twoYears())!;
    expect(out).toHaveLength(12);
    // Each year has 5 mm + 0.5 mm in the month, and only the 5 mm day counts as wet.
    expect(out[0]).toEqual({ month: 1, tmax: 11, tmin: 1, precip: 5.5, wetDays: 1 });
  });

  it("ignores null readings", () => {
    const d = twoYears();
    d.temperature_2m_max[0] = null;
    expect(aggregateDaily(d)![0]!.tmax).toBe(11);
  });

  it("returns null when a month has no data", () => {
    const d = twoYears();
    const keep = d.time.map((t) => t.slice(5, 7) !== "06");
    expect(
      aggregateDaily({
        time: d.time.filter((_, i) => keep[i]),
        temperature_2m_max: d.temperature_2m_max.filter((_, i) => keep[i]),
        temperature_2m_min: d.temperature_2m_min.filter((_, i) => keep[i]),
        precipitation_sum: d.precipitation_sum.filter((_, i) => keep[i]),
      }),
    ).toBeNull();
  });
});

describe("helpers", () => {
  it("rounds cache keys to one decimal", () => {
    expect(climateKey(13.7563, 100.5018)).toBe("13.8,100.5");
    expect(climateKey(-33.87, -151.21)).toBe("-33.9,-151.2");
  });

  it("maps WMO codes", () => {
    expect(weatherFromCode(0).label).toBe("Clear sky");
    expect(weatherFromCode(63).label).toBe("Rain");
    expect(weatherFromCode(81).label).toBe("Rain");
    expect(weatherFromCode(75).label).toBe("Snow");
    expect(weatherFromCode(95).label).toBe("Thunderstorm");
    expect(weatherFromCode(-1).label).toBe("Unknown");
  });
});
