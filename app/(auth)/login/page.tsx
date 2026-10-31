import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { SetupRequired } from "@/components/common/setup-required";
import { StaticWorld } from "@/components/map/static-world";
import { APP_NAME, isSupabaseConfigured } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!isSupabaseConfigured) return <SetupRequired />;
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface-2 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-ink text-bg">
            <Compass className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold">{APP_NAME}</span>
        </div>
        <StaticWorld
          className="pointer-events-none absolute left-1/2 top-1/2 w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-90"
          highlight={["792", "380", "392"]}
        />
        <div className="relative max-w-md">
          <p className="font-display text-[40px] font-semibold leading-[1.05]">
            Every country, city and memory. <span className="text-accent">One quiet place.</span>
          </p>
          <p className="mt-3 text-muted">Plan the route, track the budget, keep the stories.</p>
        </div>
      </section>
      <section className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-9 place-items-center rounded-xl bg-ink text-bg">
              <Compass className="size-5" />
            </div>
            <span className="font-display text-xl font-semibold">{APP_NAME}</span>
          </div>
          <h1 className="text-[32px] font-semibold">Welcome back</h1>
          <p className="mt-1.5 text-muted">Sign in to continue your journey.</p>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
