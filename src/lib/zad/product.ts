import { z } from "zod";

const imageValue = z
  .string()
  .min(1)
  .max(2_000_000)
  .refine(
    (value) =>
      /^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value) ||
      /^data:image\/jpeg;base64,[a-z0-9+/]+={0,2}$/i.test(value),
    { message: "type" },
  );

const draftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(4).max(1200),
  categoryId: z.string().uuid(),
  operation: z.enum(["sale", "rent", "exchange", "wanted"]),
  condition: z.enum(["new", "used_good", "needs_repair"]),
  salePrice: z.number().int().nonnegative().nullable(),
  rentPrice: z.number().int().nonnegative().nullable(),
  wilayaCode: z.number().int().min(1).max(58),
  images: z.array(imageValue).max(5),
});

export const productSchema = draftSchema.superRefine((value, ctx) => {
  if (value.operation === "sale" && value.salePrice == null) {
    ctx.addIssue({ code: "custom", path: ["salePrice"], message: "sale" });
  }
  if (value.operation === "rent" && value.rentPrice == null) {
    ctx.addIssue({ code: "custom", path: ["rentPrice"], message: "rent" });
  }
}).transform((value) => ({
  ...value,
  salePrice: value.operation === "sale" ? value.salePrice : null,
  rentPrice: value.operation === "rent" ? value.rentPrice : null,
}));

export const productStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["active", "unavailable"]),
});

export const productIdSchema = z.object({
  id: z.string().uuid(),
});

const fieldKey: Record<string, string> = {
  title: "gear.errTitle",
  description: "gear.errDescription",
  categoryId: "gear.errCategory",
  wilayaCode: "gear.errWilaya",
  salePrice: "gear.errSale",
  rentPrice: "gear.errRent",
  images: "gear.errImageType",
};

export function productFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field === "images" && !errors.images) {
      errors.images = issue.code === "too_big" ? "gear.errImageCount" : "gear.errImageType";
      continue;
    }
    const key = fieldKey[field];
    if (key && !errors[field]) errors[field] = key;
  }
  return errors;
}

export function parseMoney(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isInteger(amount) ? amount : Number.NaN;
}
