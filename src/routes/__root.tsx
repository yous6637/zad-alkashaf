import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/layout/preview-host-bridge";
import { ErrorPage, NotFoundPage } from "@/components/layout/status-page";
import { Toaster } from "@/components/ui/sonner";
import { dirFor, isLocale, translate } from "@/lib/i18n";
import appCss from "../styles.css?url";

function RootDocument() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const segment = pathname.split("/").filter(Boolean)[0] ?? "ar";
  const locale = isLocale(segment) ? segment : "ar";
  const dir = dirFor(locale);

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <Toaster position="bottom-center" dir={dir} />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: translate("ar", "meta.title") },
      { name: "description", content: translate("ar", "meta.description") },
      { name: "theme-color", content: "#166534" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&family=Tajawal:wght@400;500;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
});
