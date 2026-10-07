import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { BookOpenText, ChartColumn, GraduationCap, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { report, reportCrashes } from "@/lib/telemetry";
import { useCopy } from "@/lib/learn/i18n";
import { liveStreak, persistence, todayLog, useProgress } from "@/lib/learn/store";
import { pairingStored } from "@/lib/learn/sync-key";
import type { HeldSave } from "@/lib/learn/recovery";
import { SaveNotice } from "./save-notice";
import { LEARN_HOME, sectionOf } from "@/lib/sections";
import { SectionTabs } from "./section-tabs";
import { Num, Sep } from "./ui";

const serverHeld = (): HeldSave | null => null;
// Shown only when a save cannot be read, so its code (and the progress
// schema it uses) loads only then.
const RecoveryScreen = lazy(() => import("./recovery-screen").then((module) => ({ default: module.RecoveryScreen })));

const OFFLINE_ROUTES = ["/", "/learn", "/lexicon", "/study", "/drill", "/library", "/progress"] as const;

/** The four destinations. Learn and Words each group several screens. */
const NAV = [
  { to: "/", key: "today", icon: BookOpenText, section: "today" },
  { to: LEARN_HOME, key: "learn", icon: GraduationCap, section: "learn" },
  { to: "/lexicon", key: "navLexicon", icon: Search, section: "words" },
  { to: "/progress", key: "progress", icon: ChartColumn, section: "progress" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const setLang = useProgress((state) => state.setLang);
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
  const held = useSyncExternalStore(persistence.subscribe, persistence.getHeld, serverHeld);
  const dock = useRef<HTMLElement>(null);

  useEffect(() => {
    // Progress starts at once. A paired device first takes up its pairing, so
    // the sync engine starts progress itself (sync-client.ts); it loads after
    // the first screen either way.
    let alive = true;
    let stopSync = () => {};
    if (!pairingStored()) void persistence.start();
    void import("@/lib/learn/sync-client")
      .then((module) => {
        if (alive) stopSync = module.startWithSync();
      })
      .catch(() => persistence.start());
    // Save failures are reported by kind only, when the build enables reporting.
    const watch = () => {
      const status = persistence.getStatus();
      if (status === "session") report("save-failed");
      if (status === "unavailable") report("storage-unavailable");
    };
    const unsubscribe = persistence.subscribe(watch);
    const stopCrashes = reportCrashes();
    return () => {
      unsubscribe();
      stopCrashes();
      alive = false;
      stopSync();
    };
  }, []);

  useEffect(() => {
    // Lets automated checks wait until saved progress has been loaded.
    if (hydrated) document.documentElement.dataset.progressReady = "true";
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang === "fa" ? "fa" : "en";
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [hydrated, lang]);

  // Content keeps clear of the dock whatever its height, for example when
  // enlarged text wraps its labels onto two rows.
  useEffect(() => {
    const element = dock.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const top = element.getBoundingClientRect().top;
      if (element.offsetHeight > 0) document.documentElement.style.setProperty("--dock-space", `${Math.ceil(window.innerHeight - top)}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [lang]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let alive = true;

    async function prepareOffline() {
      // Installing downloads every data file. On a slow connection that would
      // compete with the first screen's own requests, so it waits until the
      // page has loaded and the browser is idle.
      await new Promise<void>((resolve) => {
        const idle = () => ("requestIdleCallback" in window ? window.requestIdleCallback(() => resolve(), { timeout: 3000 }) : setTimeout(resolve, 1000));
        if (document.readyState === "complete") idle();
        else window.addEventListener("load", idle, { once: true });
      });
      if (!alive) return;
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
  const section = sectionOf(pathname);

  return (
    // Keyed by language: Chrome can keep the old bidirectional layout of text
    // that React rewrites from Persian to English in place (for example
    // "Accuracy: –" drawn as "Accuracy :–"), so a language change rebuilds the
    // page instead. Persian, the server's language, never needs the rebuild.
    <div key={lang} className="min-h-dvh text-ink">
      <a href="#main" className="skip-link">
        {copy.skipToContent}
      </a>
      <aside className="fixed inset-y-0 start-0 z-20 hidden w-60 flex-col bg-ink px-4 py-6 text-paper md:flex">
        <Link to="/" className="mb-8 flex items-center gap-3 px-2">
          <Mark />
          <span>
            <span lang="en" className="lex-word block text-2xl leading-none">Vajefy</span>
            <span className="mt-1 block text-xs text-paper/70">{copy.brandLine}</span>
          </span>
        </Link>
        <nav aria-label={copy.mainNav} className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavItem key={item.to} to={item.to} icon={item.icon} label={copy[item.key]} active={section === item.section} />
          ))}
        </nav>
        <div className="mt-auto px-2">
          <button
            type="button"
            onClick={() => setLang(lang === "fa" ? "en" : "fa")}
            lang={lang === "fa" ? "en" : "fa"}
            className="min-h-11 text-sm text-paper/70"
          >
            {lang === "fa" ? "EN" : "فا"}
          </button>
        </div>
      </aside>

      <div className="md:ps-60">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 bg-paper/95 px-4 md:hidden">
          <Link to="/" lang="en" className="lex-word inline-flex min-h-11 items-center text-xl leading-none">
            Vajefy
          </Link>
          <span className="text-sm text-muted tabular-nums">
            <Num value={reviewsToday} />
            <span className="mx-0.5">/</span>
            <Num value={dailyGoal} />
            <span className="sr-only"> {copy.reviewsLabel}</span>
          </span>
        </header>

        <div className="hidden h-16 items-center justify-end gap-4 px-8 md:flex lg:justify-between">
          <p className="hidden text-sm text-muted lg:block">{copy.tagline}</p>
          <div className="flex items-center gap-4">
            {/* The separator must be real text: a CSS gap alone let the bidi
                algorithm read the goal and the streak as one number (20 + 1 → ۲۰۱). */}
            <span className="whitespace-nowrap text-sm text-muted">
              <Num value={reviewsToday} />
              <span className="mx-1">/</span>
              <Num value={dailyGoal} />
              <Sep />
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

        <main id="main" tabIndex={-1} className="dock-pad mx-auto w-full min-w-0 max-w-5xl px-4 py-5 outline-none md:px-8 md:py-6">
          {/* A held save replaces the app, so nothing can be learned into a
              placeholder state that could never be saved. */}
          {hydrated && held ? (
            <Suspense fallback={null}>
              <RecoveryScreen held={held} copy={copy} />
            </Suspense>
          ) : (
            <>
              {hydrated ? <SaveNotice copy={copy} /> : null}
              {section === "learn" || section === "words" ? (
                <SectionTabs section={section} pathname={pathname} copy={copy} />
              ) : null}
              {children}
            </>
          )}
        </main>
      </div>

      <nav ref={dock} aria-label={copy.mainNav} className="dock md:hidden">
        {NAV.map((item) => {
          const active = section === item.section;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-xs",
                active ? "text-paper" : "text-paper/60",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span className="whitespace-nowrap">{copy[item.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: (typeof NAV)[number]["to"];
  icon: typeof Search;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
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
    <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="6" fill="var(--color-paper)" />
      <path fill="var(--color-ink)" d="M8.4 7.6h3.75L16 19.5l3.85-11.9h3.75L18 23.4h-4z" />
    </svg>
  );
}
