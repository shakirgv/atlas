import { Compass } from "lucide-react";
import { Markdown } from "@/components/common/markdown";
import { APP_NAME } from "@/lib/config";
import type { PublicItem, PublicView } from "@/lib/share";
import { PublicMap } from "./public-map";
import { ShareGallery } from "./public-gallery";

function Item({ item, base }: { item: PublicItem; base: string }) {
  return (
    <article className="flex flex-col gap-2">
      {(item.title || item.date || item.place) && (
        <header>
          {item.title && <h3 className="text-[22px] font-semibold leading-tight">{item.title}</h3>}
          {(item.date || item.place) && <p className="mt-0.5 text-sm text-muted">{[item.place, item.date].filter(Boolean).join(" · ")}</p>}
        </header>
      )}
      {item.body && <Markdown>{item.body}</Markdown>}
      {item.photos.length > 0 && <ShareGallery photos={item.photos} base={base} />}
    </article>
  );
}

/** The page a visitor sees: read-only, no app navigation, no login prompt. A server component throughout, apart from the gallery. */
export function PublicShareView({ view, base }: { view: PublicView; base: string }) {
  const cover = view.coverId ? `${base}/photo/${view.coverId}?size=full` : null;
  const hasMap = view.countries.length > 0 || view.points.length > 0;
  // A trip shows its photos under each memory; a memory or recap shows them together.
  const gallery = view.kind === "trip" ? [] : view.photos;
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="relative isolate flex min-h-[46vh] flex-col justify-end overflow-hidden bg-surface-2">
        {cover && (
          <>
            <img src={cover} alt="" className="absolute inset-0 -z-20 size-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(0_0_0/0.1)_0%,rgb(0_0_0/0)_40%,rgb(0_0_0/0.75)_100%)]" />
          </>
        )}
        <div className={`mx-auto w-full max-w-3xl px-5 pb-8 pt-20 ${cover ? "text-white" : ""}`}>
          {view.placeLine && <p className={`text-sm font-medium ${cover ? "text-white/85" : "text-muted"}`}>{view.placeLine}</p>}
          <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] sm:text-[60px]">{view.title}</h1>
          {view.dateLine && <p className={`mt-2 text-base ${cover ? "text-white/85" : "text-muted"}`}>{view.dateLine}</p>}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 py-10">
        {view.intro && <p className="font-display text-xl leading-relaxed">{view.intro}</p>}
        {view.stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {view.stats.map((s) => (
              <div key={s.label} className="card p-4">
                <dd className="num font-display text-[32px] font-semibold leading-none">{s.value}</dd>
                <dt className="mt-1 text-sm text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
        {hasMap && (
          <section className="card overflow-hidden" aria-label="Map">
            <PublicMap countries={view.countries} points={view.points} />
          </section>
        )}
        {view.sections.map((section, i) => (
          <section key={i} className="flex flex-col gap-5">
            {section.heading && (
              <header>
                <h2 className="flex items-center gap-2.5 text-[28px] font-semibold leading-tight">
                  {section.flag && <span>{section.flag}</span>}
                  {section.heading}
                </h2>
                {section.subheading && <p className="mt-1 text-sm text-muted">{section.subheading}</p>}
              </header>
            )}
            {section.items.map((item, j) => (
              <Item key={j} item={item} base={base} />
            ))}
            {section.days.length > 0 && (
              <ol className="flex flex-col gap-4">
                {section.days.map((day, j) => (
                  <li key={j} className="border-l-2 border-accent pl-4">
                    <p className="font-display text-lg font-semibold">{day.title}</p>
                    {day.date && <p className="text-xs text-muted">{day.date}</p>}
                    {day.stops.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5 text-sm">
                        {day.stops.map((stop, k) => (
                          <li key={k} className="flex gap-2.5">
                            {stop.time && <span className="num shrink-0 text-muted">{stop.time}</span>}
                            {stop.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
        {gallery.length > 0 && <ShareGallery photos={gallery} base={base} />}
      </main>

      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-6 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <Compass className="size-3.5" /> Shared from {APP_NAME}
        </span>
        {view.attribution && <span>Cover: {view.attribution}</span>}
      </footer>
    </div>
  );
}
