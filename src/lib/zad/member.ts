import { z } from "zod";

export const memberEmailSchema = z.object({
  email: z.string().trim().email().max(120),
});

export const memberIdSchema = z.object({
  userId: z.string().trim().min(1).max(80),
});
