import { z } from 'zod';

import {
  dateRegex,
  documentTypeOptions,
  estadoRequerimientoOptions,
  fuerzaIntervinienteOptions,
  jurisdiccionOptions,
  nationalityOptions,
  recompensaAmountRegex,
  recompensaOptions,
  sexOptions
} from './constants';

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(''));
const optionalPhone = z.string().max(50).optional().or(z.literal(''));
const optionalEmail = z.string().email('Email inválido').optional().or(z.literal(''));

const additionalInfoItemSchema = z.object({
  label: z.string().trim().min(1, 'Ingresa el nombre del campo').max(120),
  value: z.string().trim().min(1, 'Ingresa un valor').max(1000)
});

const emailEntrySchema = z.object({
  value: optionalEmail
});

const phoneEntrySchema = z.object({
  value: optionalPhone
});

const socialNetworkEntrySchema = z.object({
  network: optionalText(60),
  handle: optionalText(120)
});

const casePersonSchema = z.object({
  personId: z.string().uuid().optional(),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  sex: z.enum(sexOptions),
  documentType: z.enum(documentTypeOptions).default('DNI'),
  documentName: optionalText(120),
  birthdate: z
    .string()
    .regex(dateRegex, 'Formato YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  notes: optionalText(500),
  emails: z.array(emailEntrySchema).default([]),
  phones: z.array(phoneEntrySchema).default([]),
  socialNetworks: z.array(socialNetworkEntrySchema).default([]),
  nationality: z.enum(nationalityOptions).default('ARGENTINA'),
  otherNationality: optionalText(120),
  street: optionalText(120),
  streetNumber: optionalText(20),
  province: optionalText(120),
  locality: optionalText(120),
  reference: optionalText(255)
});

export const caseFormSchema = z
  .object({
    numeroCausa: optionalText(120),
    caratula: optionalText(255),
    juzgadoInterventor: optionalText(255),
    secretaria: optionalText(255),
    fiscalia: optionalText(255),
    jurisdiccion: z.enum(jurisdiccionOptions).default('SIN_DATO'),
    delito: optionalText(255),
    fechaHecho: z
      .string()
      .regex(dateRegex, 'Formato YYYY-MM-DD')
      .optional()
      .or(z.literal('')),
    estadoRequerimiento: z.enum(estadoRequerimientoOptions),
    fuerzaAsignada: z.enum(fuerzaIntervinienteOptions).default('S/D'),
    recompensa: z.enum(recompensaOptions).default('SIN_DATO'),
    rewardAmount: z
      .string()
      .regex(recompensaAmountRegex, 'Monto inválido (máx 2 decimales)')
      .optional()
      .or(z.literal('')),
    persona: casePersonSchema,
    additionalInfo: z.array(additionalInfoItemSchema).default([])
  })
  .superRefine((data, ctx) => {
    if (data.recompensa === 'SI' && (!data.rewardAmount || data.rewardAmount.trim().length === 0)) {
      ctx.addIssue({
        path: ['rewardAmount'],
        code: z.ZodIssueCode.custom,
        message: 'Indica el monto de la recompensa'
      });
    }

    if (
      data.persona.nationality === 'OTRO' &&
      (!data.persona.otherNationality || data.persona.otherNationality.trim().length === 0)
    ) {
      ctx.addIssue({
        path: ['persona', 'otherNationality'],
        code: z.ZodIssueCode.custom,
        message: 'Especifica la nacionalidad'
      });
    }
  });

export type CaseFormValues = z.infer<typeof caseFormSchema>;

export const defaultValues: CaseFormValues = {
  numeroCausa: '',
  caratula: '',
  juzgadoInterventor: '',
  secretaria: '',
  fiscalia: '',
  jurisdiccion: 'SIN_DATO',
  delito: '',
  fechaHecho: '',
  estadoRequerimiento: 'CAPTURA_VIGENTE',
  fuerzaAsignada: 'S/D',
  recompensa: 'SIN_DATO',
  rewardAmount: '',
  persona: {
    personId: undefined,
    firstName: '',
    lastName: '',
    sex: 'MASCULINO',
    documentType: 'DNI',
    documentName: '',
    birthdate: '',
    notes: '',
    emails: [{ value: '' }],
    phones: [{ value: '' }],
    socialNetworks: [{ network: '', handle: '' }],
    nationality: 'ARGENTINA',
    otherNationality: '',
    street: '',
    streetNumber: '',
    province: '',
    locality: '',
    reference: ''
  },
  additionalInfo: []
};
