import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { defineSchema } from "@buildnbuzz/form-react";
import { toast } from "sonner";
import { z } from "zod";
import { Form, FormContent, FormFields, FormSubmit } from "@/components/buzzform/form";
import { registry } from "@/components/buzzform/registry";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/shared/controls";
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
  const schema = useMemo(
    () =>
      defineSchema({
        fields: [
          {
            type: "email",
            name: "email",
            label: t("auth.email"),
            required: true,
            autoComplete: "email",
          },
          {
            type: "password",
            name: "password",
            label: t("auth.password"),
            required: true,
            minLength: 8,
            maxLength: 72,
            autoComplete: "current-password",
          },
        ],
      }),
    [account],
  );

  if (isPending) {
    return (
      <Shell>
        <div className="mx-auto h-64 max-w-md animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (user) return <Navigate to="/$locale/account" params={{ locale: account }} />;

  return (
    <Shell>
      <div className="mx-auto grid max-w-md gap-4">
        <h1 className="text-3xl font-semibold">{t("auth.loginTitle")}</h1>
        <p className="text-sm text-muted">{t("auth.loginLead")}</p>
        {authEnabled ? (
          <>
            <Form
              registries={{ fields: registry }}
              schema={schema}
              onSubmit={async ({ value }) => {
                const parsed = loginSchema.safeParse(value);
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
              }}
            >
              <FormContent className="rounded-xl border border-border bg-card p-4">
                <FormFields />
                <FormSubmit className="h-11 w-full" submittingText={t("auth.pending")} disabled={pending}>
                  {t("auth.submitLogin")}
                </FormSubmit>
              </FormContent>
            </Form>
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