import { z } from 'zod';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const fuerzaAsignadaOptions = ['PFA', 'GNA', 'PNA', 'PSA', 'S/D'] as const;
const estadoSituacionOptions = ['VIGENTE', 'DETENIDO', 'SIN EFECTO', 'S/D'] as const;
const nationalityOptions = ['ARGENTINA', 'OTRO'] as const;

export const casePersonSchema = z.object({
  personId: z.string().uuid().optional(),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  identityNumber: z.string().max(50).optional(),
  birthdate: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  notes: z.string().max(500).optional(),
  nationality: z.enum(nationalityOptions).default('ARGENTINA'),
  otherNationality: z.string().max(120).optional(),
  addresses: z.array(z.string().min(1).max(255)).optional()
});

export const createCaseSchema = z.object({
  numeroCausa: z.string().max(120).optional(),
  fechaHecho: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  estadoSituacion: z.enum(estadoSituacionOptions),
  fuerzaAsignada: z.enum(fuerzaAsignadaOptions).default('S/D'),
  reward: z.string().max(120).optional(),
  persona: casePersonSchema
});

export const updateCaseSchema = z.object({
  numeroCausa: z.string().max(120).optional(),
  fechaHecho: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  estadoSituacion: z.enum(estadoSituacionOptions).optional(),
  fuerzaAsignada: z.enum(fuerzaAsignadaOptions).optional(),
  reward: z.string().max(120).optional(),
  persona: casePersonSchema.partial().optional()
});

export type CasePersonInput = z.infer<typeof casePersonSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
