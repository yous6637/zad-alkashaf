import { useState } from "react";
import { createFileRoute, Link, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/shell";
import { Button, controlClass, Field } from "@/components/ui";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale, translate } from "@/lib/i18n";
import { ensureMyProfile } from "@/lib/zad/api";

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(8).max(72),
});

export const Route = createFileRoute("/$locale/register")({
  beforeLoad: ({ params }) => {
    if (!isLocale(params.locale)) throw redirect({ to: "/$locale", params: { locale: "ar" } });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(account, key, vars);
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  if (isPending) {
    return (
      <Shell>
        <div className="mx-auto h-64 max-w-md animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (user) return <Navigate to="/$locale/account" params={{ locale: account }} />;

  async function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const parsed = registerSchema.safeParse({
      fullName: String(fd.get("fullName") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(t("auth.invalid"));
      return;
    }
    setPending(true);
    try {
      const result = await authClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.fullName,
        callbackURL: `/${account}/account`,
      });
      if (result.error) throw new Error(result.error.message ?? t("auth.failed"));
      await ensureMyProfile({ data: { fullName: parsed.data.fullName } });
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
        <h1 className="text-3xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="text-sm text-muted">{t("auth.registerLead")}</p>
        {authEnabled ? (
          <>
            <form
              className="space-y-3 rounded-xl border border-border bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void onSubmit(event.currentTarget);
              }}
            >
              <Field label={t("auth.name")}>
                <input className={controlClass} name="fullName" required minLength={2} autoComplete="name" />
              </Field>
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
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit" disabled={pending} className="h-11 w-full">
                {pending ? t("auth.pending") : t("auth.submitRegister")}
              </Button>
            </form>
            <Link to="/$locale/login" params={{ locale: account }} className="text-sm text-muted">
              {t("auth.haveAccount")}
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted">{t("auth.disabled")}</p>
        )}
      </div>
    </Shell>
  );
}
