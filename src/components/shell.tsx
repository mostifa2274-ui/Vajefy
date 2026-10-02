import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  BookOpenText,
  ChartColumn,
  Library,
  PenLine,
  Search,
  SquareStack,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCopy } from "@/lib/learn/i18n";
import { liveStreak, todayLog, useProgress } from "@/lib/learn/store";
import { Num } from "./ui";

const OFFLINE_ROUTES = ["/", "/lexicon", "/study", "/drill", "/library", "/progress"] as const;

const NAV = [
  { to: "/", key: "today", icon: BookOpenText, exact: true },
  { to: "/lexicon", key: "lexicon", icon: Search, exact: false },
  { to: "/study", key: "study", icon: SquareStack, exact: false },
  { to: "/drill", key: "drill", icon: PenLine, exact: false },
  { to: "/library", key: "library", icon: Library, exact: false },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const setLang = useProgress((state) => state.setLang);
  const setHydrated = useProgress((state) => state.setHydrated);
  const streak = useProgress((state) => state.streak);
  const lastStudyDate = useProgress((state) => state.lastStudyDate);
  const logs = useProgress((state) => state.logs);
  const dailyGoal = useProgress((state) => state.dailyGoal);
  const onboarded = useProgress((state) => state.onboarded);
  const copy = useCopy(lang);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    void Promise.resolve(useProgress.persist.rehydrate()).finally(() => {
      if (alive) setHydrated();
    });
    return () => {
      alive = false;
    };
  }, [setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang === "fa" ? "fa" : "en";
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [hydrated, lang]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let alive = true;

    async function prepareOffline() {
      await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
          window.setTimeout(done, 5000);
        });
      }
      if (!alive) return;

      // Ask TanStack Router to load every primary route once. Lazy route chunks
      // then pass through the controlling service worker and are cached, so an
      // installed learner can navigate to an unvisited screen while offline.
      await Promise.allSettled(OFFLINE_ROUTES.map((to) => router.preloadRoute({ to })));
      if (alive) document.documentElement.dataset.offlineReady = "true";
    }

    void prepareOffline().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    if (!hydrated || !onboarded || !navigator.storage?.persist) return;
    // Ask supporting browsers to protect the small local learning database from
    // opportunistic eviction. Denial is harmless because export/import remains.
    void navigator.storage.persist().catch(() => undefined);
  }, [hydrated, onboarded]);

  const reviewsToday = hydrated ? todayLog(logs).reviews : 0;

  return (
    <div className="min-h-dvh text-ink">
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-60 flex-col bg-ink px-4 py-6 text-paper md:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <Mark />
          <span>
            <span className="lex-word block text-2xl leading-none">Roshana</span>
            <span className="mt-1 block text-sm text-paper/70">روشنا</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              exact={item.exact}
              icon={item.icon}
              label={copy[item.key]}
              pathname={pathname}
            />
          ))}
          <NavItem to="/progress" exact={false} icon={ChartColumn} label={copy.progress} pathname={pathname} />
        </nav>
        <div className="mt-auto px-2">
          <button
            type="button"
            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
            className="min-h-11 text-sm text-paper/70"
          >
            {lang === "fa" ? "EN" : "فا"}
          </button>
        </div>
      </aside>

      <div className="md:ps-60">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 bg-paper/95 px-4 md:hidden">
          <Link to="/" className="lex-word text-xl leading-none">
            Roshana
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted tabular-nums">
              <Num value={reviewsToday} />
              <span className="mx-0.5">/</span>
              <Num value={dailyGoal} />
            </span>
            <Link to="/progress" aria-label={copy.progress} className="inline-flex size-11 items-center justify-center">
              <ChartColumn className="size-5" />
            </Link>
          </div>
        </header>

        <div className="hidden h-16 items-center justify-between gap-4 px-8 md:flex">
          <p className="text-sm text-muted">{copy.tagline}</p>
          <div className="flex items-center gap-4">
            {/* The "·" must be real text: a CSS gap alone let the bidi algorithm
                read the goal and the streak as one number (20 + 1 → ۲۰۱). */}
            <span className="text-sm text-muted">
              <Num value={reviewsToday} />
              <span className="mx-1">/</span>
              <Num value={dailyGoal} />
              <span className="mx-2" aria-hidden>
                ·
              </span>
              <Num value={hydrated ? liveStreak(streak, lastStudyDate) : 0} />
              <span className="ms-1">{copy.streakLabel}</span>
            </span>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const q = query.trim();
                if (!q) return;
                void navigate({ to: "/lexicon", search: { q } });
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="field h-11 w-64 px-3 text-sm outline-none"
                aria-label={copy.search}
              />
            </form>
          </div>
        </div>

        <main className="dock-pad mx-auto w-full min-w-0 max-w-5xl px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>

      <nav className="dock md:hidden">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                active ? "text-paper" : "text-paper/50",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="whitespace-nowrap">{item.key === "lexicon" ? copy.navLexicon : copy[item.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavItem({
  to,
  exact,
  icon: Icon,
  label,
  pathname,
}: {
  to: "/" | "/lexicon" | "/study" | "/drill" | "/library" | "/progress";
  exact: boolean;
  icon: typeof Search;
  label: string;
  pathname: string;
}) {
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm",
        active ? "bg-paper/10 text-paper" : "text-paper/70 hover:bg-paper/10 hover:text-paper",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="size-9 shrink-0 text-paper" aria-hidden>
      <circle cx="16" cy="16" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M16 3.5v3.5M16 25v3.5M3.5 16h3.5M25 16h3.5M7.2 7.2l2.4 2.4M22.4 22.4l2.4 2.4M24.8 7.2l-2.4 2.4M9.6 22.4l-2.4 2.4" />
      </g>
    </svg>
  );
}
