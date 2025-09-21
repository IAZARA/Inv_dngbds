import { z } from 'zod';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const fuerzaIntervinienteOptions = ['PFA', 'GNA', 'PNA', 'PSA', 'S/D'] as const;
const estadoRequerimientoOptions = ['CAPTURA_VIGENTE', 'SIN_EFECTO', 'DETENIDO'] as const;
const nationalityOptions = ['ARGENTINA', 'OTRO'] as const;
const sexOptions = ['MASCULINO', 'FEMENINO', 'OTRO'] as const;
const documentTypeOptions = ['DNI', 'PASAPORTE', 'CEDULA_IDENTIDAD', 'OTRO'] as const;
const jurisdiccionOptions = ['FEDERAL', 'PROVINCIAL', 'SIN_DATO'] as const;
const recompensaOptions = ['SI', 'NO', 'SIN_DATO'] as const;
const rewardAmountStatusOptions = ['KNOWN', 'UNKNOWN'] as const;
const photoDescriptionLimit = 200;
const ADDITIONAL_INFO_LABEL_LIMIT = 120;
const ADDITIONAL_INFO_VALUE_LIMIT = 1000;

const additionalInfoItemSchema = z.object({
  label: z.string().trim().min(1, 'Ingresa el nombre del campo').max(ADDITIONAL_INFO_LABEL_LIMIT),
  value: z.string().trim().min(1, 'Ingresa un valor').max(ADDITIONAL_INFO_VALUE_LIMIT)
});

const emailEntrySchema = z.object({
  value: z.string().trim().email('Email inválido').max(255).optional().or(z.literal(''))
});

const phoneEntrySchema = z.object({
  value: z.string().trim().max(50).optional().or(z.literal(''))
});

const socialNetworkEntrySchema = z.object({
  network: z.string().trim().max(60).optional().or(z.literal('')),
  handle: z.string().trim().max(120).optional().or(z.literal(''))
});

const addressEntrySchema = z.object({
  street: z.string().trim().max(120).optional().or(z.literal('')),
  streetNumber: z.string().trim().max(20).optional().or(z.literal('')),
  province: z.string().trim().max(120).optional().or(z.literal('')),
  locality: z.string().trim().max(120).optional().or(z.literal('')),
  reference: z.string().trim().max(255).optional().or(z.literal('')),
  isPrincipal: z.boolean().default(false)
});

export const casePersonSchema = z.object({
  personId: z.string().uuid().optional(),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  sex: z.enum(sexOptions),
  identityNumber: z.string().max(50).optional(),
  documentType: z.enum(documentTypeOptions).optional(),
  documentName: z.string().max(120).optional(),
  birthdate: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  nationality: z.enum(nationalityOptions).default('ARGENTINA'),
  otherNationality: z.string().max(120).optional(),
  street: z.string().max(120).optional(),
  streetNumber: z.string().max(20).optional(),
  province: z.string().max(120).optional(),
  locality: z.string().max(120).optional(),
  reference: z.string().max(255).optional(),
  emails: z.array(emailEntrySchema).optional(),
  phones: z.array(phoneEntrySchema).optional(),
  socialNetworks: z.array(socialNetworkEntrySchema).optional(),
  addresses: z.array(addressEntrySchema).optional()
});

export const createCaseSchema = z.object({
  numeroCausa: z.string().max(120).optional(),
  caratula: z.string().max(255).optional(),
  juzgadoInterventor: z.string().max(255).optional(),
  secretaria: z.string().max(255).optional(),
  fiscalia: z.string().max(255).optional(),
  jurisdiccion: z.enum(jurisdiccionOptions).default('SIN_DATO'),
  delito: z.string().max(255).optional(),
  fechaHecho: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  estadoRequerimiento: z.enum(estadoRequerimientoOptions),
  fuerzaAsignada: z.enum(fuerzaIntervinienteOptions).default('S/D'),
  recompensa: z.enum(recompensaOptions).default('SIN_DATO'),
  rewardAmountStatus: z.enum(rewardAmountStatusOptions).default('KNOWN'),
  rewardAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (hasta 2 decimales)')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  priorityValue: z
    .number()
    .min(1, 'El valor debe ser mayor a 0')
    .max(10000, 'El valor debe ser menor o igual a 10000')
    .optional()
    .or(z.null()),
  persona: casePersonSchema,
  additionalInfo: z.array(additionalInfoItemSchema).optional()
});

export const updateCaseSchema = z.object({
  numeroCausa: z.string().max(120).optional(),
  caratula: z.string().max(255).optional(),
  juzgadoInterventor: z.string().max(255).optional(),
  secretaria: z.string().max(255).optional(),
  fiscalia: z.string().max(255).optional(),
  jurisdiccion: z.enum(jurisdiccionOptions).optional(),
  delito: z.string().max(255).optional(),
  fechaHecho: z
    .string()
    .regex(dateRegex, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),
  estadoRequerimiento: z.enum(estadoRequerimientoOptions).optional(),
  fuerzaAsignada: z.enum(fuerzaIntervinienteOptions).optional(),
  recompensa: z.enum(recompensaOptions).optional(),
  rewardAmountStatus: z.enum(rewardAmountStatusOptions).optional(),
  rewardAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (hasta 2 decimales)')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  priorityValue: z
    .number()
    .min(1, 'El valor debe ser mayor a 0')
    .max(10000, 'El valor debe ser menor o igual a 10000')
    .optional()
    .or(z.null()),
  persona: casePersonSchema.partial().optional(),
  additionalInfo: z.array(additionalInfoItemSchema).optional()
});

export const mediaDescriptionSchema = z.object({
  description: z.string().max(photoDescriptionLimit)
});

const recompensaDependentValidation = (data: {
  recompensa?: (typeof recompensaOptions)[number];
  rewardAmountStatus?: (typeof rewardAmountStatusOptions)[number];
  rewardAmount?: string | null;
}) => {
  if (data.recompensa !== 'SI') {
    return null;
  }

  if (data.rewardAmountStatus === 'UNKNOWN') {
    return null;
  }

  if (data.rewardAmount === null) {
    return null;
  }

  if (!data.rewardAmount || data.rewardAmount.trim().length === 0) {
    return 'Ingresa el monto de recompensa';
  }
  return null;
};

createCaseSchema.superRefine((data, ctx) => {
  const rewardError = recompensaDependentValidation(data);
  if (rewardError) {
    ctx.addIssue({
      path: ['rewardAmount'],
      code: z.ZodIssueCode.custom,
      message: rewardError
    });
  }
  const { persona } = data;
  if (persona.nationality === 'OTRO' && !persona.otherNationality) {
    ctx.addIssue({
      path: ['persona', 'otherNationality'],
      code: z.ZodIssueCode.custom,
      message: 'Especifica la nacionalidad'
    });
  }
});

updateCaseSchema.superRefine((data, ctx) => {
  const rewardError = recompensaDependentValidation(data);
  if (rewardError) {
    ctx.addIssue({
      path: ['rewardAmount'],
      code: z.ZodIssueCode.custom,
      message: rewardError
    });
  }
  if (data.persona?.nationality === 'OTRO' && !data.persona.otherNationality) {
    ctx.addIssue({
      path: ['persona', 'otherNationality'],
      code: z.ZodIssueCode.custom,
      message: 'Especifica la nacionalidad'
    });
  }
});

export type CasePersonInput = z.infer<typeof casePersonSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type MediaDescriptionInput = z.infer<typeof mediaDescriptionSchema>;
export type AdditionalInfoInput = z.infer<typeof additionalInfoItemSchema>;
