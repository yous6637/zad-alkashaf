import { z } from "zod";

export const planSchema = z.object({
  price: z.number().int().nonnegative(),
  durationDays: z.number().int().min(1).max(3650),
  maxMembers: z.number().int().min(1).max(500),
  maxProducts: z.number().int().min(1).max(5000),
});

const fieldKey: Record<string, string> = {
  price: "admin.errPrice",
  durationDays: "admin.errDuration",
  maxMembers: "admin.errMembers",
  maxProducts: "admin.errProducts",
};

export function planFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    const key = fieldKey[field];
    if (key && !errors[field]) errors[field] = key;
  }
  return errors;
}

export function parseIntField(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return Number.NaN;
  const amount = Number(text);
  return Number.isInteger(amount) ? amount : Number.NaN;
}
