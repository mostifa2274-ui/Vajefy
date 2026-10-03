import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { EARLY_LANGUAGE } from "@/lib/early-language";
import appCss from "../styles.css?url";

const TITLE = "Vajefy";
const DESCRIPTION = "English vocabulary for Persian speakers: guided lessons, recorded pronunciation and spaced review.";
const SITE_URL = String(import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");
const SOCIAL_META = SITE_URL
  ? [
      { property: "og:image", content: `${SITE_URL}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: `${SITE_URL}/og.jpg` },
    ]
  : [];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Android shrinks the layout when the on-screen keyboard opens, so the
      // answer field and its Check button stay in view above it.
      { name: "viewport", content: "width=device-width, initial-scale=1, interactive-widget=resizes-content" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "theme-color", content: "#f6f3ec" },
      { name: "apple-mobile-web-app-title", content: TITLE },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: TITLE },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:card", content: "summary_large_image" },
      ...SOCIAL_META,
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
      ...(SITE_URL ? [{ rel: "canonical", href: SITE_URL }] : []),
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [{ children: EARLY_LANGUAGE }],
  }),
  component: () => (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Shell>
          <Outlet />
        </Shell>
        <Scripts />
      </body>
    </html>
  ),
});
