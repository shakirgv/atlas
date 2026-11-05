"use client";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CalendarDays, MapPin, PenLine, Sparkles, X } from "lucide-react";
import { createMemory, memoryLinkOptions, updateMemory } from "@/actions/memories";
import { savePhotos } from "@/actions/photos";
import { memorySchema, type z } from "@/lib/validation";
import type { MemoryVM } from "@/lib/data";
import { fmtDate, todayIso } from "@/lib/dates";
import { dayLabel, type LinkDay, type LinkPlace } from "@/lib/memory-links";
import { haversineKm } from "@/lib/utils";
import { uploadPhotos, type UploadProgress } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoDropzone, type PendingFile } from "@/components/upload/photo-dropzone";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { FormSection, SubmitButton } from "./form-bits";

type In = z.input<typeof memorySchema>;
type Out = z.output<typeof memorySchema>;
export type PlaceLite = LinkPlace;

/** Where a new memory starts when it's opened from a country or city page. */
export type MemoryPreset = { tripCountryId?: string; cityId?: string };

const MOODS = ["😊", "🤩", "😌", "😋", "🥹", "😴", "🌅", "✨", "🥾", "😅"];

/** A trip's places and itinerary days, fetched once per trip while the form is open. */
function useLinkOptions(tripId: string) {
  const [state, setState] = useState<{ tripId: string; places: LinkPlace[]; days: LinkDay[] }>({ tripId: "", places: [], days: [] });
  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    // Links are optional: if this fails, the form still works without them.
    memoryLinkOptions(tripId)
      .then((res) => {
        if (alive && res.ok) setState({ tripId, ...res.data });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tripId]);
  return state.tripId === tripId ? state : { places: [], days: [] };
}

function MemoryForm({ memory, preset, onDone, onCancel, autoFocus }: { memory?: MemoryVM; preset?: MemoryPreset; onDone?: () => void; onCancel?: () => void; autoFocus?: boolean }) {
  const ws = useWorkspace();
  const confirm = useConfirm();
  const formId = useId();
  const defaultTrip = useDefaultTripId();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState<Record<number, UploadProgress>>({});
  const [tagInput, setTagInput] = useState("");
  const [suggestion, setSuggestion] = useState<{ kind: "city" | "place"; id: string; name: string; km: number } | null>(null);

  const initial = useMemo<In>(() => {
    if (memory) {
      return {
        trip_id: memory.trip_id,
        trip_country_id: memory.trip_country_id ?? "",
        city_id: memory.city_id ?? "",
        place_id: memory.place_id ?? "",
        itinerary_day_id: memory.itinerary_day_id ?? "",
        date: memory.date,
        title: memory.title ?? "",
        body: memory.body ?? "",
        mood: memory.mood ?? "",
        tags: memory.tags,
      };
    }
    const presetCity = preset?.cityId ? ws.cities.find((c) => c.id === preset.cityId) : undefined;
    const presetCountry = ws.countries.find((c) => c.id === (presetCity?.trip_country_id ?? preset?.tripCountryId));
    return {
      trip_id: presetCountry?.trip_id ?? defaultTrip ?? "",
      trip_country_id: presetCountry?.id ?? "",
      city_id: presetCity?.id ?? "",
      place_id: "",
      itinerary_day_id: "",
      date: todayIso(),
      title: "",
      body: "",
      mood: "",
      tags: [],
    };
  }, [memory, preset, ws.cities, ws.countries, defaultTrip]);

  const form = useForm<In, unknown, Out>({ resolver: zodResolver(memorySchema), defaultValues: initial });
  const { register, handleSubmit, control, watch, setValue, reset, formState } = form;
  const tripId = watch("trip_id");
  const countryId = watch("trip_country_id") ?? "";
  const cityId = watch("city_id") ?? "";
  const placeId = watch("place_id") ?? "";
  const dayId = watch("itinerary_day_id") ?? "";
  const date = watch("date");
  const tags = watch("tags") ?? [];

  const { places, days } = useLinkOptions(tripId);
  const countries = ws.countries.filter((c) => c.trip_id === tripId);
  const cities = ws.cities.filter((c) => (countryId ? c.trip_country_id === countryId : countries.some((x) => x.id === c.trip_country_id)));
  const cityIds = new Set(cities.map((c) => c.id));
  // Any place in the chosen city, else in the chosen country, else on the trip.
  const placeChoices = places.filter((p) => (cityId ? p.city_id === cityId : cityIds.has(p.city_id)));
  const dayChoices = days.filter((d) => (countryId ? d.trip_country_id === countryId : countries.some((c) => c.id === d.trip_country_id)));
  const cityName = (id: string | null | undefined) => ws.cities.find((c) => c.id === id)?.name ?? null;
  const flagOf = (tcId: string) => ws.countries.find((c) => c.id === tcId)?.flag ?? "";

  // The folded section says what it holds, starting with the date.
  const summary = useMemo(() => {
    const place = places.find((p) => p.id === placeId)?.name;
    const country = ws.countries.find((c) => c.id === countryId);
    const where = place ?? cityName(cityId) ?? (country ? `${country.flag} ${country.name}` : null);
    const day = days.find((d) => d.id === dayId);
    return [date ? fmtDate(date, "EEE, d MMM yyyy") : "No date", where, day ? `Day ${day.day_number}` : null, tags.length ? tags.map((t) => `#${t}`).join(" ") : null].filter(Boolean).join(" · ");
  }, [date, placeId, cityId, countryId, dayId, tags, places, days, ws.countries]); // eslint-disable-line react-hooks/exhaustive-deps

  // EXIF-based suggestion: nearest place (≤1.5 km) or city (≤50 km) to the first geotagged photo.
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!files.length || cityId) return setSuggestion(null);
      const exifr = (await import("exifr")).default;
      for (const f of files) {
        try {
          const gps = (await exifr.gps(f.file)) as { latitude?: number; longitude?: number } | undefined;
          if (!gps?.latitude || !gps?.longitude) continue;
          const here = { lat: gps.latitude, lng: gps.longitude };
          const nearPlace = places
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => ({ p, km: haversineKm(here, { lat: p.lat!, lng: p.lng! }) }))
            .sort((a, b) => a.km - b.km)[0];
          if (nearPlace && nearPlace.km <= 1.5) {
            if (alive) setSuggestion({ kind: "place", id: nearPlace.p.id, name: nearPlace.p.name, km: nearPlace.km });
            return;
          }
          const nearCity = ws.cities
            .filter((c) => c.lat != null && c.lng != null && countries.some((x) => x.id === c.trip_country_id))
            .map((c) => ({ c, km: haversineKm(here, { lat: c.lat!, lng: c.lng! }) }))
            .sort((a, b) => a.km - b.km)[0];
          if (nearCity && nearCity.km <= 50) {
            if (alive) setSuggestion({ kind: "city", id: nearCity.c.id, name: nearCity.c.name, km: nearCity.km });
            return;
          }
        } catch {
          /* no EXIF */
        }
      }
      if (alive) setSuggestion(null);
    };
    void run();
    return () => {
      alive = false;
    };
  }, [files, places, ws.cities, cityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name: "trip_country_id" | "city_id" | "place_id" | "itinerary_day_id" | "date", value: string) => setValue(name, value, { shouldDirty: true });

  const pickCountry = (id: string) => {
    set("trip_country_id", id);
    set("city_id", "");
    set("place_id", "");
    if (dayId && days.find((d) => d.id === dayId)?.trip_country_id !== id) set("itinerary_day_id", "");
  };
  const pickCity = (id: string) => {
    set("city_id", id);
    if (placeId && places.find((p) => p.id === placeId)?.city_id !== id) set("place_id", "");
    const c = ws.cities.find((x) => x.id === id);
    if (c && c.trip_country_id !== countryId) {
      set("trip_country_id", c.trip_country_id);
      if (dayId && days.find((d) => d.id === dayId)?.trip_country_id !== c.trip_country_id) set("itinerary_day_id", "");
    }
  };
  const pickPlace = (id: string) => {
    set("place_id", id);
    const p = places.find((x) => x.id === id);
    if (p && p.city_id !== cityId) pickCity(p.city_id);
    if (p) set("place_id", id);
  };
  // A day brings its country, its city when none is set yet, and its date.
  const pickDay = (id: string) => {
    set("itinerary_day_id", id);
    const d = days.find((x) => x.id === id);
    if (!d) return;
    if (d.trip_country_id !== countryId) {
      set("trip_country_id", d.trip_country_id);
      set("city_id", d.city_id ?? "");
      set("place_id", "");
    } else if (!cityId && d.city_id) set("city_id", d.city_id);
    if (d.date) set("date", d.date);
  };

  const applySuggestion = () => {
    if (!suggestion) return;
    if (suggestion.kind === "place") pickPlace(suggestion.id);
    else pickCity(suggestion.id);
    setSuggestion(null);
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    if (!tags.includes(t)) setValue("tags", [...tags, t], { shouldDirty: true });
    setTagInput("");
  };

  const clear = () => {
    reset(initial);
    setFiles([]);
    setProgress({});
    setTagInput("");
    setSuggestion(null);
  };

  const cancel = async () => {
    const dirty = formState.isDirty || files.length > 0 || tagInput.trim() !== "";
    if (dirty && !(await confirm({ title: memory ? "Discard your changes?" : "Discard this memory?", confirmLabel: "Discard" }))) return;
    clear();
    onCancel?.();
  };

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      if (!values.title && !values.body && !files.length && !memory?.photos.length) return void toast.error("Write something or add a photo");
      const res = memory ? await updateMemory(memory.id, values) : await createMemory(values);
      if (!res.ok) return void toast.error(res.error);
      const id = memory?.id ?? (res.data as { id: string }).id;
      if (files.length) {
        const metas = await uploadPhotos(ws.userId, "memory", id, files.map((f) => f.file), (i, p) => setProgress((s) => ({ ...s, [i]: p })));
        if (metas.length) {
          const saved = await savePhotos("memory", id, metas, { setCover: false });
          if (!saved.ok) toast.error(saved.error);
        }
        if (metas.length < files.length) toast.error(`${files.length - metas.length} photo(s) failed to upload`);
      }
      toast.success(memory ? "Memory updated" : "Memory saved");
      if (!memory) reset({ ...initial, trip_id: values.trip_id });
      setFiles([]);
      setProgress({});
      onDone?.();
    }),
  );

  // Only title and text sit in the <form>: the photo grid has caption forms of its own, and forms can't nest.
  // The other fields are bound through react-hook-form, so they don't need to be inside it.
  return (
    <div className="flex flex-col gap-3">
      <form id={formId} onSubmit={onSubmit} className="contents">
        <Input placeholder="Title (optional)" aria-label="Title" autoFocus={autoFocus} {...register("title")} className="border-transparent bg-transparent px-0 font-display text-xl font-semibold shadow-none focus-visible:ring-0 max-md:text-xl" />
        <Textarea placeholder="What happened today? Markdown works." aria-label="Text" rows={memory ? 6 : 3} {...register("body")} className="min-h-20 border-transparent bg-transparent px-0 shadow-none focus-visible:ring-0" />
      </form>
      {memory && memory.photos.length > 0 && <PhotoGrid photos={memory.photos} entityType="memory" entityId={memory.id} canUpload={false} columns="grid-cols-4 sm:grid-cols-5" />}
      <PhotoDropzone files={files} onChange={setFiles} progress={progress} disabled={pending} compact />
      {suggestion && (
        <div className="flex items-center gap-2 rounded-xl bg-visited-soft px-3 py-2 text-sm">
          <Sparkles className="size-4 shrink-0 text-visited" />
          <span className="flex-1">
            Photo taken near <b>{suggestion.name}</b> ({suggestion.km < 1 ? `${Math.round(suggestion.km * 1000)} m` : `${Math.round(suggestion.km)} km`}). Link it?
          </span>
          <Button size="sm" variant="secondary" onClick={applySuggestion}>
            <MapPin /> Link
          </Button>
          <button type="button" aria-label="Dismiss" onClick={() => setSuggestion(null)} className="text-muted">
            <X className="size-4" />
          </button>
        </div>
      )}
      <Controller
        control={control}
        name="mood"
        render={({ field }) => (
          <div role="radiogroup" aria-label="Mood" className="flex flex-wrap gap-1">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={field.value === m}
                aria-label={`Mood ${m}`}
                onClick={() => field.onChange(field.value === m ? "" : m)}
                className={`grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-110 ${field.value === m ? "bg-accent-soft ring-2 ring-accent" : ""}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      />
      <FormSection title="Date, place and tags" summary={summary} icon={CalendarDays} forceOpen={Boolean(formState.errors.date)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="mem-date" error={formState.errors.date?.message}>
            <Input id="mem-date" type="date" {...register("date")} />
          </Field>
          {ws.trips.length > 1 ? (
            <Field label="Trip" htmlFor="mem-trip">
              <NativeSelect
                id="mem-trip"
                {...register("trip_id")}
                onChange={(e) => {
                  setValue("trip_id", e.target.value, { shouldDirty: true });
                  for (const k of ["trip_country_id", "city_id", "place_id", "itinerary_day_id"] as const) set(k, "");
                }}
              >
                {ws.trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Country" htmlFor="mem-country">
            <NativeSelect id="mem-country" value={countryId} onChange={(e) => pickCountry(e.target.value)}>
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="City" htmlFor="mem-city">
            <NativeSelect id="mem-city" value={cityId} onChange={(e) => pickCity(e.target.value)}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Place (optional)" htmlFor="mem-place" hint={placeChoices.length ? undefined : "No saved places here yet."}>
            <NativeSelect id="mem-place" value={placeId} onChange={(e) => pickPlace(e.target.value)} disabled={!placeChoices.length && !placeId}>
              <option value="">—</option>
              {placeChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {cityId ? "" : ` · ${cityName(p.city_id) ?? ""}`}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Itinerary day (optional)" htmlFor="mem-day" hint={dayChoices.length ? undefined : "No itinerary days here yet."}>
            <NativeSelect id="mem-day" value={dayId} onChange={(e) => pickDay(e.target.value)} disabled={!dayChoices.length && !dayId}>
              <option value="">—</option>
              {dayChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {countryId ? "" : `${flagOf(d.trip_country_id)} `}
                  {dayLabel(d, cityName(d.city_id))}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-surface p-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-medium">
                #{t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setValue("tags", tags.filter((x) => x !== t), { shouldDirty: true })}>
                  <X className="size-3 text-muted" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTag();
                }
              }}
              onBlur={addTag}
              placeholder="Add tag + Enter"
              className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none"
              aria-label="Add tag"
            />
          </div>
        </Field>
      </FormSection>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={cancel} disabled={pending}>
          Cancel
        </Button>
        <SubmitButton form={formId} pending={pending}>
          <PenLine /> {memory ? "Save changes" : "Save memory"}
        </SubmitButton>
      </div>
    </div>
  );
}

/** Inline composer card used at the top of the Memories page. */
export function MemoryComposerCard() {
  const ws = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const hint = useMemo(() => `Write a memory, ${ws.displayName.split(" ")[0] || "traveller"}…`, [ws.displayName]);
  if (!ws.trips.length) return null;
  return (
    <div className="card p-4 sm:p-5">
      {expanded ? (
        <MemoryForm autoFocus onDone={() => setExpanded(false)} onCancel={() => setExpanded(false)} />
      ) : (
        <button type="button" onClick={() => setExpanded(true)} className="flex w-full items-center gap-3 text-left text-muted">
          <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
            <PenLine className="size-4" />
          </span>
          <span className="flex-1 text-[15px]">{hint}</span>
          <span className="hidden text-xs sm:block">Photos · mood · tags</span>
        </button>
      )}
    </div>
  );
}

export function MemoryDialog({ open, onOpenChange, preset }: { open: boolean; onOpenChange: (o: boolean) => void; preset?: MemoryPreset }) {
  const ws = useWorkspace();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New memory" className="max-w-xl">
      {ws.trips.length ? (
        <div className="pb-2">
          <MemoryForm preset={preset} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} autoFocus />
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Create a trip first to start keeping memories.</p>
      )}
    </ResponsiveDialog>
  );
}

export function MemoryEditDialog({ memory, onOpenChange }: { memory: MemoryVM; onOpenChange: (o: boolean) => void }) {
  return (
    <ResponsiveDialog open onOpenChange={onOpenChange} title="Edit memory" className="max-w-xl">
      <div className="pb-2">
        <MemoryForm memory={memory} onDone={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
      </div>
    </ResponsiveDialog>
  );
}
