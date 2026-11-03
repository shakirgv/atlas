import { describe, expect, it } from "vitest";
import { closingPrompt, hasLeft, placesLeft, reviewHasContent } from "@/lib/closing-notes";
import { countryReviewSchema } from "@/lib/validation";
import type { CountryReview } from "@/lib/types";

const today = "2027-06-15";
const stop = (id: string, depart_date: string | null, status = "planned") => ({ id, status, arrive_date: "2027-01-01", depart_date });
const review = (trip_country_id: string, over: Partial<CountryReview> = {}) => ({ trip_country_id, completed_at: null, dismissed_at: null, ...over });

describe("when to ask", () => {
  it("asks about the country left most recently", () => {
    expect(closingPrompt([stop("a", "2027-06-01"), stop("b", "2027-06-14"), stop("c", "2027-06-10")], [], today)?.id).toBe("b");
  });

  it("doesn't ask while I'm still there or before I arrive", () => {
    expect(closingPrompt([stop("today", today), stop("later", "2027-07-01")], [], today)).toBeNull();
  });

  it("doesn't ask about a wishlist country or one without dates", () => {
    expect(closingPrompt([stop("w", "2027-06-10", "wishlist"), stop("n", null)], [], today)).toBeNull();
    expect(hasLeft(stop("w", "2027-06-10", "wishlist"), today)).toBe(false);
  });

  it("stops asking once written or dismissed, and moves on to the next one", () => {
    const list = [stop("a", "2027-06-14"), stop("b", "2027-06-10")];
    expect(closingPrompt(list, [review("a", { completed_at: "x" })], today)?.id).toBe("b");
    expect(closingPrompt(list, [review("a", { dismissed_at: "x" }), review("b", { completed_at: "x" })], today)).toBeNull();
  });

  it("gives up on trips long past", () => {
    expect(closingPrompt([stop("old", "2027-05-16")], [], today)?.id).toBe("old");
    expect(closingPrompt([stop("older", "2027-05-15")], [], today)).toBeNull();
  });
});

describe("the form", () => {
  it("offers places I didn't get to, once each", () => {
    expect(placesLeft([{ name: "Sheki", status: "want" }, { name: "Baku", status: "visited" }, { name: "Quba", status: "planned" }, { name: "Sheki", status: "planned" }])).toEqual(["Sheki", "Quba"]);
  });

  it("cleans up what it saves", () => {
    expect(countryReviewSchema.parse({ best_food: "  Dolma ", best_experience: "", enough_days: "5", return_again: "", next_visit: ["Sheki"] })).toEqual({ best_food: "Dolma", best_experience: null, overpriced: null, recommended_hotel: null, enough_days: 5, return_again: null, next_visit: ["Sheki"] });
  });

  it("refuses a nonsense number of days and answer", () => {
    expect(countryReviewSchema.safeParse({ enough_days: "2.5" }).success).toBe(false);
    expect(countryReviewSchema.safeParse({ enough_days: 0 }).success).toBe(false);
    expect(countryReviewSchema.safeParse({ return_again: "never" }).success).toBe(false);
  });

  it("knows an empty review from a written one", () => {
    const empty = { best_experience: null, best_food: null, overpriced: null, recommended_hotel: null, enough_days: null, return_again: null, next_visit: [] as string[] } as CountryReview;
    expect(reviewHasContent(empty)).toBe(false);
    expect(reviewHasContent(null)).toBe(false);
    expect(reviewHasContent({ ...empty, return_again: "yes" })).toBe(true);
    expect(reviewHasContent({ ...empty, next_visit: ["Sheki"] })).toBe(true);
  });
});
