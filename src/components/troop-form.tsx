import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, controlClass, Field } from "@/components/ui";
import { useLocale, useT } from "@/lib/use-locale";
import { getMeta, registerTroop, updateTroop } from "@/lib/zad/api";
import { troopFieldErrors, troopSchema, type TroopData } from "@/lib/zad/troop";
import type { Wilaya } from "@/lib/zad/types";

export function TroopForm({
  mode,
  initial,
  onDone,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: TroopData & { wilayaCode: number };
  onDone: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getMeta({ data: { locale } })
      .then((meta) => setWilayas(meta.wilayas))
      .catch(() => undefined);
  }, [locale]);

  if (!wilayas.length) {
    return <div className="mt-6 h-48 animate-pulse rounded-xl bg-surface" />;
  }

  return (
    <form
      className="mt-6 max-w-xl space-y-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const parsed = troopSchema.safeParse({
          name: String(fd.get("name") ?? ""),
          wilayaCode: Number(fd.get("wilayaCode")),
          commune: String(fd.get("commune") ?? ""),
          about: String(fd.get("about") ?? ""),
          phone: String(fd.get("phone") ?? ""),
        });
        if (!parsed.success) {
          setErrors(troopFieldErrors(parsed.error));
          toast.error(t("auth.invalid"));
          return;
        }
        setErrors({});
        setPending(true);
        const request =
          mode === "create"
            ? registerTroop({ data: parsed.data })
            : updateTroop({ data: parsed.data });
        request
          .then(() => {
            toast.success(t(mode === "create" ? "troop.created" : "troop.saved"));
            onDone();
          })
          .catch((error) =>
            toast.error(error instanceof Error ? error.message : t(mode === "create" ? "troop.failed" : "troop.saveFailed")),
          )
          .finally(() => setPending(false));
      }}
    >
      <h2 className="text-xl font-semibold">{t(mode === "create" ? "troop.registerTitle" : "troop.edit")}</h2>
      {mode === "create" ? <p className="text-sm text-muted">{t("troop.registerLead")}</p> : null}
      <Field label={t("troop.name")} error={errors.name ? t(errors.name) : undefined}>
        <input className={controlClass} name="name" required minLength={2} defaultValue={initial?.name ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("troop.wilaya")} error={errors.wilayaCode ? t(errors.wilayaCode) : undefined}>
          <select
            className={controlClass}
            name="wilayaCode"
            required
            defaultValue={initial?.wilayaCode ? String(initial.wilayaCode) : ""}
          >
            <option value="" disabled>
              {t("troop.wilayaPick")}
            </option>
            {wilayas.map((wilaya) => (
              <option key={wilaya.code} value={wilaya.code}>
                {wilaya.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("troop.commune")} error={errors.commune ? t(errors.commune) : undefined}>
          <input className={controlClass} name="commune" required minLength={2} defaultValue={initial?.commune ?? ""} />
        </Field>
      </div>
      <Field label={t("troop.about")} error={errors.about ? t(errors.about) : undefined}>
        <textarea
          className={`${controlClass} h-28 py-2`}
          name="about"
          required
          minLength={4}
          defaultValue={initial?.about ?? ""}
        />
      </Field>
      <Field label={t("troop.phone")} error={errors.phone ? t(errors.phone) : undefined}>
        <input className={controlClass} name="phone" defaultValue={initial?.phone ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("auth.pending") : t(mode === "create" ? "troop.create" : "troop.save")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("troop.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
