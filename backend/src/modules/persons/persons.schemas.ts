import { z } from 'zod';

export const createPersonSchema = z.object({
  identityNumber: z.string().min(3).max(50).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  birthdate: z.coerce.date().optional(),
  notes: z.string().optional()
});

export const updatePersonSchema = createPersonSchema.partial();

export const createSourceRecordSchema = z.object({
  sourceId: z.string().uuid(),
  collectedAt: z.string().datetime().optional(),
  rawPayload: z.unknown().optional(),
  summary: z.string().optional()
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type CreateSourceRecordInput = z.infer<typeof createSourceRecordSchema>;
