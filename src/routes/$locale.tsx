import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/layout/status-page";
import { isLocale, translate } from "@/lib/i18n";

export const Route = createFileRoute("/$locale")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) {
      throw redirect({ to: "/$locale", params: { locale: "ar" } });
    }
  },
  head: ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : "ar";
    return {
      meta: [
        { title: translate(locale, "meta.title") },
        { name: "description", content: translate(locale, "meta.description") },
      ],
    };
  },
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
});
