import { useMemo, useState } from "react";
import { createFileRoute, Link, Navigate, redirect, useNavigate } from "@tanstack/react-router";
import { defineSchema } from "@buildnbuzz/form-react";
import { toast } from "sonner";
import { z } from "zod";
import { Form, FormContent, FormFields, FormSubmit } from "@/components/buzzform/form";
import { registry } from "@/components/buzzform/registry";
import { Shell } from "@/components/layout/shell";
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
  const schema = useMemo(
    () =>
      defineSchema({
        fields: [
          {
            type: "text",
            name: "fullName",
            label: t("auth.name"),
            required: true,
            minLength: 2,
            maxLength: 80,
            autoComplete: "name",
          },
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
            autoComplete: "new-password",
            ui: { strengthIndicator: true, showRequirements: true },
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
        <h1 className="text-3xl font-semibold">{t("auth.registerTitle")}</h1>
        <p className="text-sm text-muted">{t("auth.registerLead")}</p>
        {authEnabled ? (
          <>
            <Form
              registries={{ fields: registry }}
              schema={schema}
              onSubmit={async ({ value }) => {
                const parsed = registerSchema.safeParse(value);
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
              }}
            >
              <FormContent className="rounded-xl border border-border bg-card p-4">
                <FormFields />
                <FormSubmit className="h-11 w-full" submittingText={t("auth.pending")} disabled={pending}>
                  {t("auth.submitRegister")}
                </FormSubmit>
              </FormContent>
            </Form>
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