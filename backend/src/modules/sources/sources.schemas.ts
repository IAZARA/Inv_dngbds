import { z } from 'zod';

export const createSourceSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.string().min(1).max(60),
  description: z.string().optional()
});

export const updateSourceSchema = createSourceSchema.partial();

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
