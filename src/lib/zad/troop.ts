import { z } from "zod";

const imageField = z
  .string()
  .max(300_000)
  .refine((value) => value.length === 0 || /^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(value))
  .transform((value) => (value.length === 0 ? null : value));

export const troopSchema = z.object({
  name: z.string().trim().min(2).max(80),
  wilayaCode: z.number().int().min(1).max(58),
  commune: z.string().trim().min(2).max(80),
  about: z.string().trim().min(4).max(600),
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((value) => (value.length > 0 ? value : null)),
  email: z
    .string()
    .trim()
    .max(160)
    .refine((value) => value.length === 0 || z.email().safeParse(value).success)
    .transform((value) => (value.length === 0 ? null : value)),
  logo: imageField,
  thumbnail: imageField,
});

export type TroopInput = z.input<typeof troopSchema>;
export type TroopData = z.output<typeof troopSchema>;

const fieldKey: Record<string, string> = {
  name: "troop.errName",
  wilayaCode: "troop.errWilaya",
  commune: "troop.errCommune",
  about: "troop.errAbout",
  phone: "troop.errPhone",
  email: "troop.errEmail",
  logo: "troop.errImage",
  thumbnail: "troop.errImage",
};

export function troopFieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    const key = fieldKey[field];
    if (key && !errors[field]) errors[field] = key;
  }
  return errors;
}
