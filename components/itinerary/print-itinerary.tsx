"use client";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { CountryVM, PlaceVM } from "@/lib/data";
import type { Booking, ItineraryDay, ItineraryItem, StopType, Trip } from "@/lib/types";
import { STOP_TYPE_META, BOOKING_TYPE_META } from "@/lib/icons";
import { fmtDate, fmtRange, fmtTime } from "@/lib/dates";
import { APP_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";

type Section = { country: CountryVM; days: { day: ItineraryDay; city: string | null; stops: (ItineraryItem & { place: PlaceVM | null })[]; bookings: Booking[] }[] };

export function PrintItinerary({ trip, sections, allTripHref, singleCountry }: { trip: Trip; sections: Section[]; allTripHref: string; singleCountry: boolean }) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/itinerary${sections[0] ? `?country=${sections[0].country.id}` : ""}`}>
            <ArrowLeft /> Back to planner
          </Link>
        </Button>
        <div className="flex gap-2">
          {singleCountry && (
            <Button variant="secondary" asChild>
              <Link href={allTripHref}>Whole trip</Link>
            </Button>
          )}
          <Button onClick={() => window.print()}>
            <Printer /> Print / Save as PDF
          </Button>
        </div>
      </div>
      <article className="rounded-[16px] bg-white p-8 text-[#15181E] shadow-card print:p-0 print:shadow-none sm:p-12">
        <header className="border-b-2 border-[#15181E] pb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#61656e]">{APP_NAME} · Itinerary</p>
          <h1 className="mt-2 text-[40px] font-semibold leading-none">{trip.title}</h1>
          <p className="mt-2 text-sm text-[#61656e]">{fmtRange(trip.start_date, trip.end_date)}</p>
        </header>
        {sections.map(({ country, days }) => (
          <section key={country.id} className="mt-8">
            <h2 className="print-break flex items-baseline gap-3 text-[28px] font-semibold">
              <span>{country.flag}</span> {country.name}
              <span className="text-sm font-normal text-[#61656e]">{fmtRange(country.arrive_date, country.depart_date)}</span>
            </h2>
            {!days.length && <p className="mt-2 text-sm text-[#61656e]">No days planned yet.</p>}
            <ol className="mt-4 flex flex-col gap-5">
              {days.map(({ day, city, stops, bookings }) => (
                <li key={day.id} className="print-break border-l-2 border-[#E8532F] pl-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#E8532F]">
                    Day {day.day_number}
                    {day.date ? ` · ${fmtDate(day.date, "EEEE, dd MMM yyyy")}` : ""}
                    {city ? ` · ${city}` : ""}
                  </p>
                  {day.title && <p className="mt-0.5 font-display text-lg font-semibold">{day.title}</p>}
                  {day.notes && <p className="mt-1 text-sm text-[#61656e]">{day.notes}</p>}
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-t border-[#E7E1D6]">
                          <td className="w-24 py-1.5 pr-3 align-top font-mono text-xs">{b.start_at?.slice(11, 16)}</td>
                          <td className="py-1.5 align-top">
                            <b>{BOOKING_TYPE_META[b.type as keyof typeof BOOKING_TYPE_META]?.label ?? "Booking"}:</b> {b.title}
                            {b.confirmation_no ? <span className="ml-2 font-mono text-xs">#{b.confirmation_no}</span> : null}
                          </td>
                        </tr>
                      ))}
                      {stops.map((s) => (
                        <tr key={s.id} className="border-t border-[#E7E1D6]">
                          <td className="w-24 py-1.5 pr-3 align-top font-mono text-xs">
                            {fmtTime(s.start_time) || "—"}
                            {s.end_time ? `–${fmtTime(s.end_time)}` : ""}
                          </td>
                          <td className="py-1.5 align-top">
                            <span className="font-medium">{s.title}</span>
                            <span className="ml-2 text-xs text-[#61656e]">{STOP_TYPE_META[s.type as StopType]?.label}</span>
                            {s.place?.address && <span className="block text-xs text-[#61656e]">{s.place.address}</span>}
                            {s.notes && <span className="block text-xs text-[#61656e]">{s.notes}</span>}
                          </td>
                          <td className="w-6 py-1.5 align-top">{s.done ? "✓" : "☐"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </article>
    </div>
  );
}
