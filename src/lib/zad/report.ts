import { z } from "zod";

export const reportSchema = z.object({
  productId: z.string().uuid(),
  reason: z.enum(["wrong_info", "inappropriate", "duplicate", "other"]),
  note: z.string().trim().max(400),
});

export const productRefSchema = z.object({
  productId: z.string().uuid(),
});

export function reportFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field === "note" && !errors.note) errors.note = "product.errNote";
    if (field === "reason" && !errors.reason) errors.reason = "product.errReason";
  }
  return errors;
}
