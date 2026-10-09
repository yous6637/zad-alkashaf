import { useState } from "react";
import { createFileRoute, Link, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/layout/shell";
import { Button, controlClass, Field } from "@/components/shared/controls";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale, translate } from "@/lib/i18n";

const loginSchema = z.object({
  email: z.email().max(120),
  password: z.string().min(8).max(72),
});

export const Route = createFileRoute("/$locale/login")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw redirect({ to: "/$locale", params: { locale: "ar" } });
  },
  component: LoginPage,
});

function LoginPage() {
  const { locale } = Route.useParams();
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(isLocale(locale) ? locale : "ar", key, vars);
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const account = isLocale(locale) ? locale : "ar";

  if (isPending) {
    return (
      <Shell>
        <div className="mx-auto h-64 max-w-md animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (user) return <Navigate to="/$locale/account" params={{ locale: account }} />;

  async function onSubmit(form: HTMLFormElement) {
    const parsed = loginSchema.safeParse({
      email: String(new FormData(form).get("email") ?? ""),
      password: String(new FormData(form).get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(t("auth.invalid"));
      return;
    }
    setPending(true);
    try {
      const result = await authClient.signIn.email({
        email: parsed.data.email,
        password: parsed.data.password,
        callbackURL: `/${account}/account`,
      });
      if (result.error) throw new Error(result.error.message ?? t("auth.failed"));
      await navigate({ to: "/$locale/account", params: { locale: account } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted">{t("auth.loginLead")}</p>
        {authEnabled ? (
          <>
            <form
              className="space-y-3 rounded-xl border border-border bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void onSubmit(event.currentTarget);
              }}
            >
              <Field label={t("auth.email")}>
                <input className={controlClass} name="email" type="email" required autoComplete="email" />
              </Field>
              <Field label={t("auth.password")}>
                <input
                  className={controlClass}
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" disabled={pending} className="h-11 w-full">
                {pending ? t("auth.pending") : t("auth.submitLogin")}
              </Button>
            </form>
            <Link to="/$locale/register" params={{ locale: account }} className="text-sm text-muted">
              {t("auth.needAccount")}
            </Link>
            <div className="space-y-2">
              {GROK_PROVIDERS.map((provider) => (
                <Button
                  key={provider.providerId}
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  onClick={() => signIn(provider.providerId, { callbackURL: `/${account}/account` })}
                >
                  {t("auth.continueWith", { provider: provider.label })}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">{t("auth.disabled")}</p>
        )}
      </div>
    </Shell>
  );
}
