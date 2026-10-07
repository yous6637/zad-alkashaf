import { useState } from "react";
import { toast } from "sonner";
import { Button, controlClass, Field } from "@/components/shared/controls";
import { useLocale, useT } from "@/lib/use-locale";
import { requestSubscription } from "@/lib/zad/api";
import { proofErrorKey, proofSchema } from "@/lib/zad/subscription";
import type { Plan } from "@/lib/zad/types";

function money(locale: string, value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SubscriptionForm({
  plan,
  renew,
  pendingProof,
  onDone,
}: {
  plan: Plan | null;
  renew: boolean;
  pendingProof: string | null;
  onDone: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-4 max-w-xl space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!plan || pendingProof) return;
        const parsed = proofSchema.safeParse({
          proof: String(new FormData(event.currentTarget).get("proof") ?? ""),
        });
        if (!parsed.success) {
          setError(proofErrorKey(parsed.error));
          toast.error(t("auth.invalid"));
          return;
        }
        setError(null);
        setPending(true);
        requestSubscription({ data: parsed.data })
          .then(() => {
            toast.success(t("sub.sent"));
            onDone();
          })
          .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("sub.failed")))
          .finally(() => setPending(false));
      }}
    >
      <h2 className="font-semibold">{t(renew ? "sub.renewTitle" : "sub.requestTitle")}</h2>
      <p className="text-sm text-muted">{t("sub.lead")}</p>
      {plan ? (
        <ul className="space-y-1 text-sm">
          <li>
            {t("sub.planName")}: {plan.name}
          </li>
          <li>{t("sub.price", { amount: money(locale, plan.price) })}</li>
          <li>{t("sub.duration", { count: plan.durationDays })}</li>
          <li>{t("sub.members", { count: plan.maxMembers })}</li>
          <li>{t("sub.products", { count: plan.maxProducts })}</li>
        </ul>
      ) : (
        <p className="text-sm text-danger">{t("sub.noPlan")}</p>
      )}
      {renew ? <p className="text-sm text-muted">{t("sub.currentNote")}</p> : null}
      {pendingProof ? <p className="text-sm text-muted">{t("sub.pendingProof", { proof: pendingProof })}</p> : null}
      <Field label={t("sub.proof")} error={error ? t(error) : undefined}>
        <textarea
          className={`${controlClass} h-24 py-2`}
          name="proof"
          required
          minLength={4}
          disabled={pending || !!pendingProof || !plan}
        />
      </Field>
      <p className="text-sm text-muted">{t("sub.proofHint")}</p>
      <Button type="submit" disabled={pending || !!pendingProof || !plan}>
        {pending ? t("auth.pending") : t("sub.submit")}
      </Button>
    </form>
  );
}
