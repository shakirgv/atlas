import { Database, KeyRound, Rocket, Terminal, UserPlus } from "lucide-react";
import { APP_NAME } from "@/lib/config";

const STEPS = [
  {
    icon: Database,
    title: "Create a Supabase project",
    body: "Go to supabase.com → New project. Then open Project Settings → API.",
  },
  {
    icon: KeyRound,
    title: "Add the two keys to .env.local",
    body: "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (copy .env.example). Never use the service-role key.",
  },
  {
    icon: Terminal,
    title: "Run the SQL migrations",
    body: "In the SQL editor, run supabase/migrations/001_init.sql, then 002_extras.sql.",
  },
  {
    icon: UserPlus,
    title: "Create your user",
    body: "Authentication → Users → Add user. Then turn off “Allow new users to sign up”.",
  },
  {
    icon: Rocket,
    title: "Restart the dev server",
    body: "Stop and run npm run dev again so the new env vars load. On Vercel, add the same two env vars and redeploy.",
  },
];

export function SetupRequired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <div className="eyebrow">{APP_NAME} · Setup required</div>
        <h1 className="text-[40px] font-semibold">Almost ready to travel.</h1>
        <p className="text-[15px] text-muted">
          {APP_NAME} needs a Supabase project to store your trips. It takes about five minutes.
        </p>
      </div>
      <ol className="card divide-y divide-border">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 p-5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <s.icon className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                <span className="num mr-2 text-muted">{i + 1}.</span>
                {s.title}
              </p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">The full checklist lives in README.md under “What you must do manually”.</p>
    </main>
  );
}
