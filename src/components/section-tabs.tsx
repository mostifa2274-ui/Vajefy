import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import type { Copy } from "@/lib/learn/i18n";
import { LEARN_HOME } from "@/lib/sections";

const TABS = {
  learn: {
    label: "learnSections",
    items: [
      { to: "/learn", key: "tabLessons" },
      { to: "/study", key: "study" },
      { to: "/drill", key: "drill" },
    ],
  },
  words: {
    label: "wordsSections",
    items: [
      { to: "/lexicon", key: "lexicon" },
      { to: "/library", key: "library" },
    ],
  },
} as const;

/** The screens inside Learn or Words, as one row of tabs. */
export function SectionTabs({ section, pathname, copy }: { section: "learn" | "words"; pathname: string; copy: Copy }) {
  const group = TABS[section];
  // Without guided lessons (the study's comparison arm) Learn has no Lessons tab.
  const items = group.items.filter((item) => item.to !== "/learn" || LEARN_HOME === "/learn");
  return (
    <nav aria-label={copy[group.label]} className="mb-5">
      <ul className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-paper-2 p-1 shadow-[var(--shadow-border)]">
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-4 text-sm",
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-accent-soft hover:text-ink",
                )}
              >
                {copy[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
