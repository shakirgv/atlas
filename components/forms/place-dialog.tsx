"use client";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CopyCheck, Loader2, MapPin, NotebookPen, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { createPlace, loadCityPlaces, updatePlace } from "@/actions/places";
import { placeSchema, type z } from "@/lib/validation";
import { similarPlaces } from "@/lib/place-duplicates";
import { PLACE_CATEGORIES, PLACE_STATUSES, type Place, type PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { PLACE_STATUS_META } from "@/lib/status";
import { CURRENCIES } from "@/lib/money";
import { primaryCurrency } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useAutoCover } from "@/hooks/use-auto-cover";
import { useGeocode } from "@/hooks/use-geocode";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { MapView } from "@/components/map/map";
import { useWorkspace } from "@/components/shell/workspace";
import { ChoiceChips, FormSection, SubmitButton } from "./form-bits";

type In = z.input<typeof placeSchema>;
type Out = z.output<typeof placeSchema>;
type Saved = { id: string; name: string; city_id: string; lat: number | null; lng: number | null; status: string; address: string | null };

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

/** Places already saved in a city, loaded once per city while adding, so a similar name can point at the one that exists. */
function useCityPlaces(cityId: string, enabled: boolean) {
  const [byCity, setByCity] = useState<Record<string, Saved[]>>({});
  useEffect(() => {
    if (!enabled || !cityId || byCity[cityId]) return;
    let alive = true;
    void loadCityPlaces(cityId).then((res) => {
      if (alive && res.ok) setByCity((m) => ({ ...m, [cityId]: res.data }));
    });
    return () => {
      alive = false;
    };
  }, [cityId, enabled, byCity]);
  return byCity[cityId] ?? [];
}

export function PlaceDialog({
  open,
  onOpenChange,
  place,
  cityId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  place?: Place | null;
  cityId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const autoCover = useAutoCover();
  const defaultCity = place?.city_id ?? cityId ?? ws.cities[0]?.id ?? "";

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(placeSchema),
    values: {
      name: place?.name ?? "",
      city_id: defaultCity,
      category: (place?.category as Out["category"]) ?? "sight",
      status: (place?.status as Out["status"]) ?? "want",
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      address: place?.address ?? "",
      url: place?.url ?? "",
      rating: place?.rating ?? null,
      cost_estimate: place?.cost_estimate ?? "",
      cost_currency: place?.cost_currency ?? "",
      opening_hours: place?.opening_hours ?? "",
      notes: place?.notes ?? "",
    },
  });
  const { register, handleSubmit, control, setValue, watch, formState } = form;
  const selectedCityId = watch("city_id");
  const lat = watch("lat");
  const lng = watch("lng");
  const name = watch("name");
  const address = watch("address");
  const hours = watch("opening_hours");
  const cost = watch("cost_estimate");
  const url = watch("url");
  const notes = watch("notes");
  const rating = watch("rating");
  const city = ws.cities.find((c) => c.id === selectedCityId);
  const near = city?.lat != null && city?.lng != null ? { lat: city.lat, lng: city.lng } : null;
  const { results, loading } = useGeocode(query, { near, country: city?.country_code ?? null, enabled: open && !place });
  const pinned = typeof lat === "number" && typeof lng === "number";

  // Adding only: a similar name already saved in this city is offered instead of a second copy.
  const saved = useCityPlaces(selectedCityId, open && !place);
  const typed = useDeferredValue(name ?? "");
  const similar = useMemo(
    () => (place ? [] : similarPlaces({ name: typed, city_id: selectedCityId, lat: pinned ? lat : null, lng: pinned ? lng : null }, saved).slice(0, 3)),
    [place, typed, selectedCityId, saved, pinned, lat, lng],
  );

  const openExisting = (id: string) => {
    onOpenChange(false);
    // On the Places page its filters stay as they are; anywhere else the place opens on a plain Places page.
    const params = new URLSearchParams(pathname === "/places" ? window.location.search : "");
    params.set("open", id);
    router.push(`/places?${params}`, { scroll: false });
  };

  const markers = useMemo(
    () => (pinned ? [{ id: "pin", lat: lat as number, lng: lng as number, label: name || "New place", color: "var(--accent)", glyph: "●" }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lng],
  );

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = place ? await updatePlace(place.id, values) : await createPlace(values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(place ? "Place updated" : "Place added");
      if (!place && res.data && typeof res.data === "object" && "id" in res.data) {
        autoCover("place", [res.data.id]);
        onSaved?.(res.data.id);
      }
      setQuery("");
      onOpenChange(false);
    }),
  );

  const locationSummary = [filled(address) ? String(address) : "No address", pinned ? "Pinned" : "No pin"].join(" · ");
  const visitSummary =
    [rating ? `★ ${rating}` : null, filled(hours) ? "Hours" : null, filled(cost) ? "Cost" : null, filled(url) ? "Link" : null, filled(notes) ? "Notes" : null].filter(Boolean).join(" · ") ||
    "Rating, opening hours, cost, link and notes";
  const errors = formState.errors;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={place ? "Edit place" : "Add a place"}
      description={place ? undefined : "Search for it, drop a pin, or just type a name."}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="place-form" pending={pending} disabled={!ws.cities.length}>
            {place ? "Save changes" : similar.length ? "Add anyway" : "Add place"}
          </SubmitButton>
        </>
      }
    >
      {!ws.cities.length ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Places belong to a city. Add a city first, then come back.</p>
      ) : (
        <form id="place-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2" data-testid="place-form">
          {!place && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search in ${city?.name ?? "the city"}…`} className="pl-9" aria-label="Search places" autoFocus />
              {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
              {results.length > 0 && query && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-ink/5 dark:hover:bg-white/5"
                        onClick={() => {
                          setValue("name", r.name, { shouldValidate: true });
                          setValue("address", r.address ?? r.label);
                          setValue("lat", r.lat);
                          setValue("lng", r.lng);
                          setQuery("");
                        }}
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.name}</span>
                          <span className="block truncate text-xs text-muted">{r.label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Field label="Name" htmlFor="place-name" error={errors.name?.message}>
            <Input id="place-name" placeholder="Senso-ji temple" {...register("name")} />
          </Field>
          {similar.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-planned/40 bg-planned-soft p-3" role="status" data-testid="similar-places">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CopyCheck className="size-4 shrink-0 text-ink" /> Possible duplicate in {city?.name ?? "this city"}
              </p>
              <ul className="flex flex-col gap-1.5">
                {similar.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface/70 px-2.5 py-2">
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted">
                        {" · "}
                        {PLACE_STATUS_META[p.status as PlaceStatus]?.label ?? p.status}
                        {p.address ? ` · ${p.address}` : ""}
                      </span>
                    </span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => openExisting(p.id)}>
                      Use existing place
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">Or keep going to save it as a separate place.</p>
            </div>
          )}
          <Field label="City" htmlFor="place-city" error={errors.city_id?.message}>
            <NativeSelect id="place-city" {...register("city_id")}>
              {ws.cities.map((c) => {
                const country = ws.countries.find((x) => x.id === c.trip_country_id);
                return (
                  <option key={c.id} value={c.id}>
                    {country?.flag} {c.name}
                  </option>
                );
              })}
            </NativeSelect>
          </Field>
          <Field label="Category">
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <ChoiceChips
                  name="Category"
                  value={field.value}
                  onChange={field.onChange}
                  options={PLACE_CATEGORIES.map((c) => ({ value: c, label: PLACE_CATEGORY_META[c].label, icon: PLACE_CATEGORY_META[c].icon, color: PLACE_CATEGORY_META[c].color }))}
                />
              )}
            />
          </Field>
          <Field label="Status">
            <Controller
              control={control}
              name="status"
              render={({ field }) => <ChoiceChips name="Status" value={field.value} onChange={field.onChange} options={PLACE_STATUSES.map((s) => ({ value: s, label: PLACE_STATUS_META[s].label }))} />}
            />
          </Field>

          <FormSection title="Location" summary={locationSummary} icon={MapPin} defaultOpen={Boolean(place)} forceOpen={Boolean(errors.address || errors.lat || errors.lng)}>
            <Field label="Address" htmlFor="place-address" error={errors.address?.message}>
              <Input id="place-address" {...register("address")} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                Pin
                {pinned ? (
                  <span className="num flex items-center gap-2 text-xs font-normal text-muted">
                    {(lat as number).toFixed(4)}, {(lng as number).toFixed(4)}
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => {
                        setValue("lat", null);
                        setValue("lng", null);
                      }}
                    >
                      Remove pin
                    </button>
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted">No pin yet</span>
                )}
              </span>
              <MapView
                allowEmpty
                className="h-52 rounded-xl"
                markers={markers}
                center={markers[0] ? [markers[0].lat, markers[0].lng] : near ? [near.lat, near.lng] : undefined}
                zoom={13}
                onMapClick={(la, ln) => {
                  setValue("lat", Number(la.toFixed(6)));
                  setValue("lng", Number(ln.toFixed(6)));
                }}
              />
              <span className="text-xs text-muted">Tap the map to set the exact spot.</span>
            </div>
          </FormSection>

          <FormSection title="Visit details" summary={visitSummary} icon={NotebookPen} defaultOpen={Boolean(place)} forceOpen={Boolean(errors.url || errors.cost_estimate || errors.rating || errors.opening_hours || errors.notes)}>
            <Field label="Rating">
              <Controller
                control={control}
                name="rating"
                render={({ field }) => (
                  <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={field.value === n}
                        aria-label={`${n} star${n > 1 ? "s" : ""}`}
                        onClick={() => field.onChange(field.value === n ? null : n)}
                        className="grid size-9 place-items-center rounded-lg hover:bg-ink/5"
                      >
                        <Star className={cn("size-5", Number(field.value ?? 0) >= n ? "fill-planned text-planned" : "text-border")} />
                      </button>
                    ))}
                  </div>
                )}
              />
            </Field>
            <Field label="Opening hours" htmlFor="place-hours" error={errors.opening_hours?.message}>
              <Input id="place-hours" placeholder="09:00–17:00, closed Mon" {...register("opening_hours")} />
            </Field>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Cost estimate" htmlFor="place-cost" error={errors.cost_estimate?.message}>
                <Input id="place-cost" inputMode="decimal" placeholder="25" {...register("cost_estimate")} />
              </Field>
              <Field label="Currency" htmlFor="place-cur">
                <NativeSelect id="place-cur" {...register("cost_currency")}>
                  <option value="">{primaryCurrency(city?.country_code) ?? "—"}</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Link" htmlFor="place-url" error={errors.url?.message}>
              <Input id="place-url" type="url" placeholder="https://" {...register("url")} />
            </Field>
            <Field label="Notes" htmlFor="place-notes" error={errors.notes?.message}>
              <Textarea id="place-notes" {...register("notes")} />
            </Field>
          </FormSection>
        </form>
      )}
    </ResponsiveDialog>
  );
}
