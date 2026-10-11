import { useState } from "react";
import { toast } from "sonner";
import { Button, controlClass, Field, Modal } from "@/components/shared/controls";
import { productImageUrl, readProductImage } from "@/lib/zad/image";
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

export function ProductForm({
  item,
  categories,
  wilayas,
  defaultWilaya,
  onSaved,
}: {
  item: Listing | null;
  categories: Category[];
  wilayas: Wilaya[];
  defaultWilaya: number;
  onSaved: () => void;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<DraftImage[]>(() =>
    (item?.images ?? []).map((path) => ({ key: path, src: productImageUrl(path), stored: path })),
  );

  return (
    <form
      className="max-w-2xl space-y-3"
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
          images: images.map((image) => image.stored ?? image.src),
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
        <select className={controlClass} name="wilayaCode" required defaultValue={item?.wilayaCode ?? defaultWilaya}>
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
      <ProductImages images={images} error={errors.images ? t(errors.images) : undefined} onChange={setImages} />
      <Button type="submit" disabled={pending || categories.length === 0}>
        {pending ? t("auth.pending") : t("gear.save")}
      </Button>
    </form>
  );
}

type DraftImage = { key: string; src: string; stored?: string };

function ProductImages({
  images,
  error,
  onChange,
}: {
  images: DraftImage[];
  error?: string;
  onChange: (images: DraftImage[]) => void;
}) {
  const t = useT();

  async function addFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (!files.length) return;
    if (images.length + files.length > 5) {
      toast.error(t("gear.errImageCount"));
      return;
    }
    const next = [...images];
    for (const file of files) {
      try {
        const src = await readProductImage(file);
        next.push({ key: crypto.randomUUID(), src });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        toast.error(t(code === "size" ? "gear.errImageSize" : "gear.errImageType"));
      }
    }
    onChange(next);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    onChange(next);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{t("gear.images")}</legend>
      <p className="text-sm text-muted">{t("gear.imagesHint")}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <div key={image.key} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={image.src} alt="" className="aspect-4/3 w-full object-cover" />
            <div className="grid grid-cols-3">
              <button
                type="button"
                className="min-h-11 text-sm"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                {t("gear.moveEarlier")}
              </button>
              <button
                type="button"
                className="min-h-11 text-sm"
                disabled={index === images.length - 1}
                onClick={() => move(index, 1)}
              >
                {t("gear.moveLater")}
              </button>
              <button
                type="button"
                className="min-h-11 text-sm text-danger"
                onClick={() => onChange(images.filter((item) => item.key !== image.key))}
              >
                {t("gear.removeImage")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {images.length < 5 ? (
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border bg-card px-4 text-sm font-medium">
          {t("gear.addImages")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              void addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}
    </fieldset>
  );
}

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
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t(item ? "gear.editTitle" : "gear.newTitle")}>
      <ProductForm
        item={item}
        categories={categories}
        wilayas={wilayas}
        defaultWilaya={defaultWilaya}
        onSaved={onSaved}
      />
    </Modal>
  );
}
