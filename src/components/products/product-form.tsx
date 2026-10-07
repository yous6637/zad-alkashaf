import { useState } from "react";
import { toast } from "sonner";
import { Button, controlClass, Field, Modal } from "@/components/shared/controls";
import { useT } from "@/lib/use-locale";
import { saveProduct } from "@/lib/zad/api";
import { parseMoney, productFieldErrors, productSchema } from "@/lib/zad/product";
import type { Category, Listing, Wilaya } from "@/lib/zad/types";

const OPERATIONS = ["sale", "rent", "exchange", "wanted"] as const;
const CONDITIONS = ["new", "used_good", "needs_repair"] as const;

const operationKey = {
  sale: "gear.opSale",
  rent: "gear.opRent",
  exchange: "gear.opExchange",
  wanted: "gear.opWanted",
} as const;

const conditionKey = {
  new: "gear.condNew",
  used_good: "gear.condUsed",
  needs_repair: "gear.condRepair",
} as const;

export function ProductDialog({
  item,
  categories,
  wilayas,
  defaultWilaya,
  onClose,
  onSaved,
}: {
  item: Listing | null;
  categories: Category[];
  wilayas: Wilaya[];
  defaultWilaya: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t(item ? "gear.editTitle" : "gear.newTitle")}>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const parsed = productSchema.safeParse({
            id: item?.id,
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            categoryId: String(fd.get("categoryId") ?? ""),
            operation: String(fd.get("operation") ?? ""),
            condition: String(fd.get("condition") ?? ""),
            salePrice: parseMoney(fd.get("salePrice")),
            rentPrice: parseMoney(fd.get("rentPrice")),
            wilayaCode: Number(fd.get("wilayaCode")),
          });
          if (!parsed.success) {
            setErrors(productFieldErrors(parsed.error));
            toast.error(t("auth.invalid"));
            return;
          }
          setErrors({});
          setPending(true);
          saveProduct({ data: parsed.data })
            .then(() => {
              toast.success(t("gear.saved"));
              onSaved();
            })
            .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("gear.saveFailed")))
            .finally(() => setPending(false));
        }}
      >
        <Field label={t("gear.title")} error={errors.title ? t(errors.title) : undefined}>
          <input className={controlClass} name="title" required minLength={2} defaultValue={item?.title ?? ""} />
        </Field>
        <Field label={t("gear.category")} error={errors.categoryId ? t(errors.categoryId) : undefined}>
          <select className={controlClass} name="categoryId" required defaultValue={item?.categoryId ?? ""}>
            <option value="" disabled>
              {t("gear.errCategory")}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("gear.operation")}>
            <select className={controlClass} name="operation" defaultValue={item?.operation ?? "sale"}>
              {OPERATIONS.map((id) => (
                <option key={id} value={id}>
                  {t(operationKey[id])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("gear.condition")}>
            <select className={controlClass} name="condition" defaultValue={item?.condition ?? "used_good"}>
              {CONDITIONS.map((id) => (
                <option key={id} value={id}>
                  {t(conditionKey[id])}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("gear.sale")} error={errors.salePrice ? t(errors.salePrice) : undefined}>
            <input className={controlClass} name="salePrice" type="number" min={0} defaultValue={item?.salePrice ?? ""} />
          </Field>
          <Field label={t("gear.rent")} error={errors.rentPrice ? t(errors.rentPrice) : undefined}>
            <input className={controlClass} name="rentPrice" type="number" min={0} defaultValue={item?.rentPrice ?? ""} />
          </Field>
        </div>
        <Field label={t("gear.wilaya")} error={errors.wilayaCode ? t(errors.wilayaCode) : undefined}>
          <select
            className={controlClass}
            name="wilayaCode"
            required
            defaultValue={item?.wilayaCode ?? defaultWilaya}
          >
            {wilayas.map((wilaya) => (
              <option key={wilaya.code} value={wilaya.code}>
                {wilaya.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("gear.description")} error={errors.description ? t(errors.description) : undefined}>
          <textarea
            className={`${controlClass} h-28 py-2`}
            name="description"
            required
            minLength={4}
            defaultValue={item?.description ?? ""}
          />
        </Field>
        <Button type="submit" disabled={pending || categories.length === 0}>
          {pending ? t("auth.pending") : t("gear.save")}
        </Button>
      </form>
    </Modal>
  );
}
