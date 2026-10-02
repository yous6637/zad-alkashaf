import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, controlClass, Field } from "@/components/ui";
import { useLocale, useT } from "@/lib/use-locale";
import { getMeta, registerTroop, updateTroop } from "@/lib/zad/api";
import { readTroopImage } from "@/lib/zad/image";
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
  const [logo, setLogo] = useState(initial?.logo ?? "");
  const [thumbnail, setThumbnail] = useState(initial?.thumbnail ?? "");

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
          email: String(fd.get("email") ?? ""),
          logo,
          thumbnail,
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
        <input className={controlClass} name="phone" type="tel" autoComplete="tel" defaultValue={initial?.phone ?? ""} />
      </Field>
      <Field label={t("troop.email")} error={errors.email ? t(errors.email) : undefined}>
        <input
          className={controlClass}
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={initial?.email ?? ""}
        />
      </Field>
      <ImagePick
        label={t("troop.logo")}
        hint={t("troop.imageHint")}
        value={logo}
        error={errors.logo ? t(errors.logo) : undefined}
        round
        onPick={async (file) => {
          try {
            setLogo(await readTroopImage(file, 256));
            setErrors((current) => ({ ...current, logo: "" }));
          } catch {
            toast.error(t("troop.errImage"));
          }
        }}
        onClear={() => setLogo("")}
      />
      <ImagePick
        label={t("troop.thumbnail")}
        hint={t("troop.imageHint")}
        value={thumbnail}
        error={errors.thumbnail ? t(errors.thumbnail) : undefined}
        onPick={async (file) => {
          try {
            setThumbnail(await readTroopImage(file, 960));
            setErrors((current) => ({ ...current, thumbnail: "" }));
          } catch {
            toast.error(t("troop.errImage"));
          }
        }}
        onClear={() => setThumbnail("")}
      />
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

function ImagePick({
  label,
  hint,
  value,
  error,
  round,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  error?: string;
  round?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <Field label={label} error={error}>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`grid overflow-hidden bg-sand-soft ${round ? "size-20 rounded-full" : "h-24 w-40 rounded-xl"}`}
        >
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-border bg-card px-4 text-sm font-medium">
            {hint}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPick(file);
              }}
            />
          </label>
          {value ? (
            <Button type="button" variant="ghost" onClick={onClear}>
              {t("troop.removeImage")}
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
