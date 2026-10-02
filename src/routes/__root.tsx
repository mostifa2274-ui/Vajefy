import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import appCss from "../styles.css?url";

const TITLE = "Roshana";
const DESCRIPTION = "Oxford English for Persian speakers — recall, spacing, and real sentences.";
const SITE_URL = String(import.meta.env.VITE_SITE_URL ?? "").replace(/\/+$/, "");
const SOCIAL_META = SITE_URL
  ? [
      { property: "og:image", content: `${SITE_URL}/og.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:image", content: `${SITE_URL}/og.jpg` },
    ]
  : [];

/**
 * Zustand hydrates after the first render. Apply the saved document direction
 * before body paint so returning English learners never see an RTL flash.
 */
const EARLY_LANGUAGE = `
try {
  const raw = localStorage.getItem("roshana-v1");
  const lang = raw ? JSON.parse(raw)?.state?.lang : null;
  if (lang === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
} catch {}
`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
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
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Vazirmatn:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: EARLY_LANGUAGE }} />
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
