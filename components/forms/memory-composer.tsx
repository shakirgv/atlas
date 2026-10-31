"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MapPin, PenLine, Sparkles, X } from "lucide-react";
import { createMemory } from "@/actions/memories";
import { savePhotos } from "@/actions/photos";
import { memorySchema, type z } from "@/lib/validation";
import { todayIso } from "@/lib/dates";
import { haversineKm } from "@/lib/utils";
import { uploadPhotos, type UploadProgress } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { PhotoDropzone, type PendingFile } from "@/components/upload/photo-dropzone";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { MoreDetails, SubmitButton } from "./form-bits";

type In = z.input<typeof memorySchema>;
type Out = z.output<typeof memorySchema>;
export type PlaceLite = { id: string; name: string; city_id: string; lat: number | null; lng: number | null };

const MOODS = ["😊", "🤩", "😌", "😋", "🥹", "😴", "🌅", "✨", "🥾", "😅"];

function MemoryForm({ places = [], onDone, autoFocus }: { places?: PlaceLite[]; onDone?: () => void; autoFocus?: boolean }) {
  const ws = useWorkspace();
  const defaultTrip = useDefaultTripId();
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [progress, setProgress] = useState<Record<number, UploadProgress>>({});
  const [tagInput, setTagInput] = useState("");
  const [suggestion, setSuggestion] = useState<{ kind: "city" | "place"; id: string; name: string; km: number } | null>(null);

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(memorySchema),
    defaultValues: { trip_id: defaultTrip ?? "", trip_country_id: "", city_id: "", place_id: "", date: todayIso(), title: "", body: "", mood: "", tags: [] },
  });
  const { register, handleSubmit, control, watch, setValue, reset, formState } = form;
  const tripId = watch("trip_id");
  const countryId = watch("trip_country_id");
  const cityId = watch("city_id");
  const countries = ws.countries.filter((c) => c.trip_id === tripId);
  const cities = ws.cities.filter((c) => (countryId ? c.trip_country_id === countryId : countries.some((x) => x.id === c.trip_country_id)));
  const cityPlaces = places.filter((p) => p.city_id === cityId);

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
            .filter((c) => c.lat != null && c.lng != null)
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
  }, [files, places, ws.cities, cityId]);

  const applySuggestion = () => {
    if (!suggestion) return;
    if (suggestion.kind === "place") {
      const p = places.find((x) => x.id === suggestion.id)!;
      const c = ws.cities.find((x) => x.id === p.city_id);
      if (c) {
        setValue("trip_country_id", c.trip_country_id);
        setValue("city_id", c.id);
      }
      setValue("place_id", p.id);
    } else {
      const c = ws.cities.find((x) => x.id === suggestion.id)!;
      setValue("trip_country_id", c.trip_country_id);
      setValue("city_id", c.id);
    }
    setSuggestion(null);
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    const tags = watch("tags") ?? [];
    if (!tags.includes(t)) setValue("tags", [...tags, t]);
    setTagInput("");
  };

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      if (!values.title && !values.body && !files.length) return void toast.error("Write something or add a photo");
      const res = await createMemory(values);
      if (!res.ok) return void toast.error(res.error);
      if (files.length) {
        const metas = await uploadPhotos(ws.userId, "memory", res.data.id, files.map((f) => f.file), (i, p) => setProgress((s) => ({ ...s, [i]: p })));
        if (metas.length) {
          const saved = await savePhotos("memory", res.data.id, metas, { setCover: false });
          if (!saved.ok) toast.error(saved.error);
        }
        if (metas.length < files.length) toast.error(`${files.length - metas.length} photo(s) failed to upload`);
      }
      toast.success("Memory saved");
      reset({ trip_id: values.trip_id, trip_country_id: "", city_id: "", place_id: "", date: todayIso(), title: "", body: "", mood: "", tags: [] });
      setFiles([]);
      setProgress({});
      onDone?.();
    }),
  );

  return (
    <form id="memory-form" onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input placeholder="Title (optional)" aria-label="Title" autoFocus={autoFocus} {...register("title")} className="border-transparent bg-transparent px-0 font-display text-xl font-semibold shadow-none focus-visible:ring-0 max-md:text-xl" />
      <Textarea placeholder="What happened today? Markdown works." aria-label="Text" rows={3} {...register("body")} className="min-h-20 border-transparent bg-transparent px-0 shadow-none focus-visible:ring-0" />
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
      <div className="flex flex-wrap items-center gap-1.5">
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
                  onClick={() => field.onChange(field.value === m ? "" : m)}
                  className={`grid size-9 place-items-center rounded-full text-lg transition-transform hover:scale-110 ${field.value === m ? "bg-accent-soft ring-2 ring-accent" : ""}`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        />
      </div>
      <MoreDetails label="Date, place and tags">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" htmlFor="mem-date" error={formState.errors.date?.message}>
            <Input id="mem-date" type="date" {...register("date")} />
          </Field>
          {ws.trips.length > 1 ? (
            <Field label="Trip" htmlFor="mem-trip">
              <NativeSelect id="mem-trip" {...register("trip_id")}>
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
            <NativeSelect id="mem-country" {...register("trip_country_id")} onChange={(e) => { setValue("trip_country_id", e.target.value); setValue("city_id", ""); setValue("place_id", ""); }}>
              <option value="">—</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="City" htmlFor="mem-city">
            <NativeSelect id="mem-city" {...register("city_id")} onChange={(e) => { setValue("city_id", e.target.value); setValue("place_id", ""); const c = ws.cities.find((x) => x.id === e.target.value); if (c) setValue("trip_country_id", c.trip_country_id); }}>
              <option value="">—</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {cityPlaces.length > 0 && (
            <Field label="Place" htmlFor="mem-place" className="col-span-2">
              <NativeSelect id="mem-place" {...register("place_id")}>
                <option value="">—</option>
                {cityPlaces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        <Field label="Tags">
          <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-surface p-1.5">
            {(watch("tags") ?? []).map((t) => (
              <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-medium">
                #{t}
                <button type="button" aria-label={`Remove ${t}`} onClick={() => setValue("tags", (watch("tags") ?? []).filter((x) => x !== t))}>
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
      </MoreDetails>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>
          <PenLine /> Save memory
        </SubmitButton>
      </div>
    </form>
  );
}

/** Inline composer card used at the top of the Memories page. */
export function MemoryComposerCard({ places }: { places?: PlaceLite[] }) {
  const ws = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const hint = useMemo(() => `Write a memory, ${ws.displayName.split(" ")[0] || "traveller"}…`, [ws.displayName]);
  if (!ws.trips.length) return null;
  return (
    <div className="card p-4 sm:p-5">
      {expanded ? (
        <MemoryForm places={places} autoFocus />
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

export function MemoryDialog({ open, onOpenChange, places }: { open: boolean; onOpenChange: (o: boolean) => void; places?: PlaceLite[] }) {
  const ws = useWorkspace();
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} title="New memory" className="max-w-xl">
      {ws.trips.length ? (
        <div className="pb-2">
          <MemoryForm places={places} onDone={() => onOpenChange(false)} autoFocus />
        </div>
      ) : (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Create a trip first to start keeping memories.</p>
      )}
    </ResponsiveDialog>
  );
}
