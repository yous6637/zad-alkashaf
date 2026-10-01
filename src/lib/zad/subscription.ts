import { z } from "zod";

export const proofSchema = z.object({
  proof: z.string().trim().min(4).max(400),
});

export function proofErrorKey(error: z.ZodError) {
  return error.issues.some((issue) => issue.path[0] === "proof") ? "sub.errProof" : "auth.invalid";
}
