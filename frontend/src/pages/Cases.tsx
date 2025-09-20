import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { CaseMediaItem, CaseRecord, EstadoRequerimiento } from '../types';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;

const fuerzaIntervinienteOptions = ['PFA', 'GNA', 'PNA', 'PSA', 'S/D'] as const;
const estadoRequerimientoOptions = ['CAPTURA_VIGENTE', 'SIN_EFECTO', 'DETENIDO'] as const;
const nationalityOptions = ['ARGENTINA', 'OTRO'] as const;
const sexOptions = ['MASCULINO', 'FEMENINO', 'OTRO'] as const;
const documentTypeOptions = ['DNI', 'PASAPORTE', 'CEDULA_IDENTIDAD', 'OTRO'] as const;
const jurisdiccionOptions = ['FEDERAL', 'PROVINCIAL', 'SIN_DATO'] as const;
const recompensaOptions = ['SI', 'NO', 'SIN_DATO'] as const;

const defaultPhotoDescription = 'Foto del investigado';
const defaultDocumentDescription = 'Documento adjunto';

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

const recompensaAmountRegex = /^\d{1,15}(\.\d{1,2})?$/;

// Función para formatear el texto de las opciones
const formatOptionText = (text: string) => {
  return text.replace(/_/g, ' ');
};

const caseFormSchema = z
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

    if (data.persona.nationality === 'OTRO' && (!data.persona.otherNationality || data.persona.otherNationality.trim().length === 0)) {
      ctx.addIssue({
        path: ['persona', 'otherNationality'],
        code: z.ZodIssueCode.custom,
        message: 'Especifica la nacionalidad'
      });
    }
  });

type CaseFormValues = z.infer<typeof caseFormSchema>;

type CasesListResponse = { cases: CaseRecord[] };

type TabId =
  | 'identidad'
  | 'contacto'
  | 'domicilio'
  | 'judicial'
  | 'informacion'
  | 'fotos'
  | 'documentos';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'identidad', label: 'Identidad' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'domicilio', label: 'Domicilio' },
  { id: 'judicial', label: 'Datos Judiciales' },
  { id: 'informacion', label: 'Información complementaria' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'documentos', label: 'Documentos' }
];

const defaultValues: CaseFormValues = {
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

const blankToUndefined = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toValueEntries = (
  entries?: Array<{ value: string }> | null,
  fallback?: string | null
): Array<{ value: string }> => {
  const list: Array<{ value: string }> = [];
  const seen = new Set<string>();

  (entries ?? []).forEach((entry) => {
    if (!entry) return;
    const raw = typeof entry.value === 'string' ? entry.value.trim() : '';
    if (!raw || seen.has(raw)) return;
    seen.add(raw);
    list.push({ value: raw });
  });

  if (fallback) {
    const trimmedFallback = fallback.trim();
    if (trimmedFallback.length > 0 && !seen.has(trimmedFallback)) {
      list.unshift({ value: trimmedFallback });
      seen.add(trimmedFallback);
    }
  }

  if (list.length === 0) {
    list.push({ value: '' });
  }

  return list;
};

const toSocialEntries = (
  entries?: Array<{ network: string; handle: string }> | null
): Array<{ network: string; handle: string }> => {
  const list: Array<{ network: string; handle: string }> = [];
  (entries ?? []).forEach((entry) => {
    if (!entry) return;
    const network = typeof entry.network === 'string' ? entry.network : '';
    const handle = typeof entry.handle === 'string' ? entry.handle : '';
    list.push({ network, handle });
  });
  if (list.length === 0) {
    list.push({ network: '', handle: '' });
  }
  return list;
};

const mapCaseToForm = (record: CaseRecord): CaseFormValues => ({
  numeroCausa: record.numeroCausa ?? '',
  caratula: record.caratula ?? '',
  juzgadoInterventor: record.juzgadoInterventor ?? '',
  secretaria: record.secretaria ?? '',
  fiscalia: record.fiscalia ?? '',
  jurisdiccion: record.jurisdiccion,
  delito: record.delito ?? '',
  fechaHecho: record.fechaHecho ? record.fechaHecho.slice(0, 10) : '',
  estadoRequerimiento: record.estadoRequerimiento ?? 'CAPTURA_VIGENTE',
  fuerzaAsignada: (record.fuerzaAsignada as CaseFormValues['fuerzaAsignada']) ?? 'S/D',
  recompensa: record.recompensa ?? 'SIN_DATO',
  rewardAmount: record.rewardAmount ?? '',
  persona: {
    personId: record.persona?.id,
    firstName: record.persona?.firstName ?? '',
    lastName: record.persona?.lastName ?? '',
    sex: record.persona?.sex ?? 'MASCULINO',
    documentType: record.persona?.documentType ?? 'DNI',
    documentName: record.persona?.documentName ?? '',
    birthdate: record.persona?.birthdate ? record.persona.birthdate.slice(0, 10) : '',
    notes: record.persona?.notes ?? '',
    emails: toValueEntries(record.persona?.emails ?? null, record.persona?.email ?? null),
    phones: toValueEntries(record.persona?.phones ?? null, record.persona?.phone ?? null),
    socialNetworks: toSocialEntries(record.persona?.socialNetworks ?? null),
    nationality: record.persona?.nationality ?? 'ARGENTINA',
    otherNationality: record.persona?.otherNationality ?? '',
    street: record.persona?.street ?? '',
    streetNumber: record.persona?.streetNumber ?? '',
    province: record.persona?.province ?? '',
    locality: record.persona?.locality ?? '',
    reference: record.persona?.reference ?? ''
  },
  additionalInfo: record.additionalInfo?.map((entry) => ({
    label: entry.label,
    value: entry.value
  })) ?? []
});

const normalizeAdditionalInfo = (entries: CaseFormValues['additionalInfo']) => {
  return entries
    .map((entry) => ({
      label: entry.label.trim().slice(0, 120),
      value: entry.value.trim().slice(0, 1000)
    }))
    .filter((entry) => entry.label.length > 0 && entry.value.length > 0);
};

const normalizeEmailEntries = (entries: Array<{ value: string }>) => {
  return entries
    .map((entry) => entry.value.trim().toLowerCase().slice(0, 255))
    .filter((value) => value.length > 0)
    .map((value) => ({ value }));
};

const normalizePhoneEntries = (entries: Array<{ value: string }>) => {
  return entries
    .map((entry) => entry.value.trim().slice(0, 50))
    .filter((value) => value.length > 0)
    .map((value) => ({ value }));
};

const normalizeSocialNetworkEntries = (
  entries: Array<{ network: string; handle: string }>
) => {
  return entries
    .map((entry) => ({
      network: entry.network.trim().slice(0, 60),
      handle: entry.handle.trim().slice(0, 120)
    }))
    .filter((entry) => entry.network.length > 0 && entry.handle.length > 0);
};

const buildPayload = (values: CaseFormValues) => {
  const normalizedEmails = normalizeEmailEntries(values.persona.emails);
  const normalizedPhones = normalizePhoneEntries(values.persona.phones);
  const normalizedSocialNetworks = normalizeSocialNetworkEntries(values.persona.socialNetworks);

  return {
  numeroCausa: blankToUndefined(values.numeroCausa),
  caratula: blankToUndefined(values.caratula),
  juzgadoInterventor: blankToUndefined(values.juzgadoInterventor),
  secretaria: blankToUndefined(values.secretaria),
  fiscalia: blankToUndefined(values.fiscalia),
  jurisdiccion: values.jurisdiccion,
  delito: blankToUndefined(values.delito),
  fechaHecho: blankToUndefined(values.fechaHecho),
  estadoRequerimiento: values.estadoRequerimiento,
  fuerzaAsignada: values.fuerzaAsignada,
  recompensa: values.recompensa,
  rewardAmount:
    values.recompensa === 'SI' ? blankToUndefined(values.rewardAmount) : undefined,
  persona: {
    personId: values.persona.personId,
    firstName: values.persona.firstName,
    lastName: values.persona.lastName,
    sex: values.persona.sex,
    documentType: values.persona.documentType,
    documentName: blankToUndefined(values.persona.documentName),
    birthdate: blankToUndefined(values.persona.birthdate),
    email: normalizedEmails[0]?.value,
    phone: normalizedPhones[0]?.value,
    emails: normalizedEmails,
    phones: normalizedPhones,
    socialNetworks: normalizedSocialNetworks,
    notes: blankToUndefined(values.persona.notes),
    nationality: values.persona.nationality,
    otherNationality:
      values.persona.nationality === 'OTRO'
        ? blankToUndefined(values.persona.otherNationality)
        : undefined,
    street: blankToUndefined(values.persona.street),
    streetNumber: blankToUndefined(values.persona.streetNumber),
    province: blankToUndefined(values.persona.province),
    locality: blankToUndefined(values.persona.locality),
    reference: blankToUndefined(values.persona.reference)
  },
  additionalInfo: normalizeAdditionalInfo(values.additionalInfo)
  };
};

const computeAge = (dateString?: string) => {
  if (!dateString) return '';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return '';
  const diff = Date.now() - parsed.getTime();
  if (diff <= 0) return '';
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
};

const formatPersonSummary = (persona: CaseRecord['persona']) => {
  if (!persona) return 'Sin persona asociada';
  const pieces: string[] = [];
  if (persona.street || persona.streetNumber) {
    pieces.push(`${persona.street ?? 'S/D'} ${persona.streetNumber ?? ''}`.trim());
  }
  if (persona.locality || persona.province) {
    pieces.push([persona.locality, persona.province].filter(Boolean).join(', '));
  }
  if (persona.reference) {
    pieces.push(`Ref.: ${persona.reference}`);
  }
  return pieces.length > 0 ? pieces.join(' · ') : 'Sin domicilio informado';
};

const collectContactList = (
  primary?: string | null,
  entries?: Array<{ value: string }>
) => {
  const list: string[] = [];
  const normalizedPrimary = primary?.trim();
  if (normalizedPrimary) {
    list.push(normalizedPrimary);
  }
  (entries ?? []).forEach((entry) => {
    if (!entry) return;
    const value = entry.value?.trim();
    if (!value || list.includes(value)) return;
    list.push(value);
  });
  return list;
};

const collectSocialList = (
  entries?: Array<{ network: string; handle: string }>
) => {
  const list: string[] = [];
  (entries ?? []).forEach((entry) => {
    if (!entry) return;
    const network = entry.network?.trim();
    const handle = entry.handle?.trim();
    if (!network || !handle) return;
    list.push(`${network}: ${handle}`);
  });
  return list;
};

const translateEstado = (estado: EstadoRequerimiento) => {
  switch (estado) {
    case 'CAPTURA_VIGENTE':
      return 'Captura vigente';
    case 'SIN_EFECTO':
      return 'Sin efecto';
    case 'DETENIDO':
      return 'Detenido';
    default:
      return estado;
  }
};

const CasesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = useMemo(() => (user ? ['ADMIN', 'OPERATOR'].includes(user.role) : false), [user]);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('identidad');
  const [photos, setPhotos] = useState<CaseMediaItem[]>([]);
  const [documents, setDocuments] = useState<CaseMediaItem[]>([]);
  const [photoDescriptions, setPhotoDescriptions] = useState<Record<string, string>>({});
  const [documentDescriptions, setDocumentDescriptions] = useState<Record<string, string>>({});
  const [photoFormDescription, setPhotoFormDescription] = useState<string>(defaultPhotoDescription);
  const [documentFormDescription, setDocumentFormDescription] = useState<string>(
    defaultDocumentDescription
  );
  const [photoFormFile, setPhotoFormFile] = useState<File | null>(null);
  const [documentFormFile, setDocumentFormFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  
  // Función para verificar si una pestaña tiene errores
  const hasTabErrors = (tabId: TabId): boolean => {
    switch (tabId) {
      case 'identidad':
        return !!(
          errors.persona?.firstName ||
          errors.persona?.lastName ||
          errors.persona?.sex ||
          errors.persona?.birthdate ||
          errors.persona?.documentName ||
          errors.persona?.otherNationality
        );
      case 'contacto':
        return !!(
          errors.persona?.emails ||
          errors.persona?.phones ||
          errors.persona?.socialNetworks ||
          errors.persona?.notes
        );
      case 'domicilio':
        return !!(
          errors.persona?.street ||
          errors.persona?.streetNumber ||
          errors.persona?.province ||
          errors.persona?.locality ||
          errors.persona?.reference
        );
      case 'judicial':
        return !!(
          errors.numeroCausa ||
          errors.caratula ||
          errors.juzgadoInterventor ||
          errors.secretaria ||
          errors.fiscalia ||
          errors.jurisdiccion ||
          errors.delito ||
          errors.fechaHecho ||
          errors.estadoRequerimiento ||
          errors.fuerzaAsignada ||
          errors.recompensa ||
          errors.rewardAmount
        );
      case 'informacion':
        return Array.isArray(errors.additionalInfo)
          ? errors.additionalInfo.some((entry) => !!entry)
          : false;
      default:
        return false;
    }
  };

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const { data } = await api.get<CasesListResponse>('/cases');
      return data.cases;
    }
  });

  const resolver = zodResolver(caseFormSchema) as Resolver<CaseFormValues>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting }
  } = useForm<CaseFormValues>({
    resolver,
    defaultValues
  });

  const birthdateValue = useWatch({ control, name: 'persona.birthdate' });
  const nationalityValue = useWatch({ control, name: 'persona.nationality' });
  const recompensaValue = useWatch({ control, name: 'recompensa' });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail
  } = useFieldArray({
    control,
    name: 'persona.emails'
  });

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone
  } = useFieldArray({
    control,
    name: 'persona.phones'
  });

  const {
    fields: socialFields,
    append: appendSocialNetwork,
    remove: removeSocialNetwork
  } = useFieldArray({
    control,
    name: 'persona.socialNetworks'
  });

  const {
    fields: additionalInfoFields,
    append: appendAdditionalInfo,
    remove: removeAdditionalInfo
  } = useFieldArray({
    control,
    name: 'additionalInfo'
  });

  useEffect(() => {
    if (!showForm) {
      reset(defaultValues);
      setActiveTab('identidad');
      setPhotos([]);
      setDocuments([]);
      setPhotoDescriptions({});
      setDocumentDescriptions({});
      setPhotoFormDescription(defaultPhotoDescription);
      setDocumentFormDescription(defaultDocumentDescription);
      setPhotoFormFile(null);
      setDocumentFormFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (documentInputRef.current) documentInputRef.current.value = '';
      return;
    }

    if (editingCase) {
      reset(mapCaseToForm(editingCase));
      setPhotos(editingCase.photos ?? []);
      setDocuments(editingCase.documents ?? []);
    } else {
      reset(defaultValues);
      setPhotos([]);
      setDocuments([]);
    }
    setPhotoFormDescription(defaultPhotoDescription);
    setDocumentFormDescription(defaultDocumentDescription);
    setPhotoFormFile(null);
    setDocumentFormFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
    setActiveTab('identidad');
  }, [showForm, editingCase, reset]);

  useEffect(() => {
    setPhotoDescriptions((current) => {
      const next = { ...current } as Record<string, string>;
      let changed = false;
      const existingIds = new Set(photos.map((item) => item.id));

      photos.forEach((photo) => {
        const value = photo.description ?? defaultPhotoDescription;
        if (next[photo.id] !== value) {
          next[photo.id] = value;
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!existingIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [photos]);

  useEffect(() => {
    setDocumentDescriptions((current) => {
      const next = { ...current } as Record<string, string>;
      let changed = false;
      const existingIds = new Set(documents.map((item) => item.id));

      documents.forEach((doc) => {
        const value = doc.description ?? defaultDocumentDescription;
        if (next[doc.id] !== value) {
          next[doc.id] = value;
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!existingIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [documents]);

  const createMutation = useMutation({
    mutationFn: async (payload: CaseFormValues) => {
      const { data } = await api.post('/cases', buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowForm(false);
      setEditingCase(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CaseFormValues }) => {
      const { data } = await api.patch(`/cases/${id}`, buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowForm(false);
      setEditingCase(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cases/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setEditingCase((current) => {
        if (current && current.id === id) {
          setShowForm(false);
          return null;
        }
        return current;
      });
    }
  });

  const photoUploadMutation = useMutation({
    mutationFn: async ({
      caseId,
      file,
      description
    }: {
      caseId: string;
      file: File;
      description: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      const { data } = await api.post(`/cases/${caseId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data.photo as CaseMediaItem;
    },
    onSuccess: (photo) => {
      setPhotos((current) => {
        const next = [...current, photo];
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, photos: next } : currentCase
        );
        return next;
      });
      setPhotoFormDescription(defaultPhotoDescription);
      setPhotoFormFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const documentUploadMutation = useMutation({
    mutationFn: async ({
      caseId,
      file,
      description
    }: {
      caseId: string;
      file: File;
      description: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      const { data } = await api.post(`/cases/${caseId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data.document as CaseMediaItem;
    },
    onSuccess: (document) => {
      setDocuments((current) => {
        const next = [...current, document];
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, documents: next } : currentCase
        );
        return next;
      });
      setDocumentFormDescription(defaultDocumentDescription);
      setDocumentFormFile(null);
      if (documentInputRef.current) documentInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const photoDescriptionMutation = useMutation({
    mutationFn: async ({
      caseId,
      photoId,
      description
    }: {
      caseId: string;
      photoId: string;
      description: string;
    }) => {
      const { data } = await api.patch(`/cases/${caseId}/photos/${photoId}`, { description });
      return data.photo as CaseMediaItem;
    },
    onSuccess: (photo) => {
      setPhotos((current) => {
        const next = current.map((item) => (item.id === photo.id ? photo : item));
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, photos: next } : currentCase
        );
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const documentDescriptionMutation = useMutation({
    mutationFn: async ({
      caseId,
      documentId,
      description
    }: {
      caseId: string;
      documentId: string;
      description: string;
    }) => {
      const { data } = await api.patch(`/cases/${caseId}/documents/${documentId}`, { description });
      return data.document as CaseMediaItem;
    },
    onSuccess: (document) => {
      setDocuments((current) => {
        const next = current.map((item) => (item.id === document.id ? document : item));
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, documents: next } : currentCase
        );
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const photoDeleteMutation = useMutation({
    mutationFn: async ({ caseId, photoId }: { caseId: string; photoId: string }) => {
      await api.delete(`/cases/${caseId}/photos/${photoId}`);
    },
    onSuccess: (_data, variables) => {
      setPhotos((current) => {
        const next = current.filter((item) => item.id !== variables.photoId);
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, photos: next } : currentCase
        );
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const documentDeleteMutation = useMutation({
    mutationFn: async ({ caseId, documentId }: { caseId: string; documentId: string }) => {
      await api.delete(`/cases/${caseId}/documents/${documentId}`);
    },
    onSuccess: (_data, variables) => {
      setDocuments((current) => {
        const next = current.filter((item) => item.id !== variables.documentId);
        setEditingCase((currentCase) =>
          currentCase ? { ...currentCase, documents: next } : currentCase
        );
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFormFile(file);
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDocumentFormFile(file);
  };

  const handlePhotoUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCase?.id || !photoFormFile) {
      return;
    }
    photoUploadMutation.mutate({
      caseId: editingCase.id,
      file: photoFormFile,
      description: photoFormDescription
    });
  };

  const handleDocumentUpload = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCase?.id || !documentFormFile) {
      return;
    }
    documentUploadMutation.mutate({
      caseId: editingCase.id,
      file: documentFormFile,
      description: documentFormDescription
    });
  };

  const handlePhotoDescriptionInput = (photoId: string, value: string) => {
    setPhotoDescriptions((current) => ({ ...current, [photoId]: value.slice(0, 200) }));
  };

  const handleDocumentDescriptionInput = (documentId: string, value: string) => {
    setDocumentDescriptions((current) => ({ ...current, [documentId]: value.slice(0, 200) }));
  };

  const commitPhotoDescription = (photo: CaseMediaItem) => {
    if (!editingCase?.id) return;
    const value = photoDescriptions[photo.id] ?? '';
    if ((photo.description ?? '') === value) {
      return;
    }
    photoDescriptionMutation.mutate({
      caseId: editingCase.id,
      photoId: photo.id,
      description: value
    });
  };

  const commitDocumentDescription = (document: CaseMediaItem) => {
    if (!editingCase?.id) return;
    const value = documentDescriptions[document.id] ?? '';
    if ((document.description ?? '') === value) {
      return;
    }
    documentDescriptionMutation.mutate({
      caseId: editingCase.id,
      documentId: document.id,
      description: value
    });
  };

  const onSubmit = (values: CaseFormValues) => {
    if (!canEdit) return;
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handledCases = useMemo(() => casesQuery.data ?? [], [casesQuery.data]);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | EstadoRequerimiento>('TODOS');
  const [jurisdiccionFilter, setJurisdiccionFilter] =
    useState<'TODAS' | CaseFormValues['jurisdiccion']>('TODAS');
  const [fuerzaFilter, setFuerzaFilter] = useState<'TODAS' | CaseFormValues['fuerzaAsignada']>('TODAS');
  const filteredCases = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return handledCases.filter((item) => {
      const searchPool = [
        item.numeroCausa ?? undefined,
        item.caratula ?? undefined,
        item.persona?.firstName ?? undefined,
        item.persona?.lastName ?? undefined,
        item.persona
          ? `${item.persona.firstName ?? ''} ${item.persona.lastName ?? ''}`.trim() || undefined
          : undefined,
      ];

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchPool.some((field) => {
          if (!field) return false;
          return field.toLowerCase().includes(normalizedSearch);
        });

      if (!matchesSearch) return false;

      const matchesEstado =
        estadoFilter === 'TODOS' || item.estadoRequerimiento === estadoFilter;

      if (!matchesEstado) return false;

      const matchesJurisdiccion =
        jurisdiccionFilter === 'TODAS' || item.jurisdiccion === jurisdiccionFilter;

      if (!matchesJurisdiccion) return false;

      const forceValue = (item.fuerzaAsignada ?? 'S/D') as CaseFormValues['fuerzaAsignada'];
      const matchesFuerza = fuerzaFilter === 'TODAS' || forceValue === fuerzaFilter;

      return matchesFuerza;
    });
  }, [handledCases, estadoFilter, fuerzaFilter, jurisdiccionFilter, searchTerm]);
  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const ageValue = computeAge(birthdateValue ?? undefined);

  const handleStartCreate = () => {
    setEditingCase(null);
    reset(defaultValues);
    setActiveTab('identidad');
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingCase(null);
    reset(defaultValues);
    setShowForm(false);
    setActiveTab('identidad');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'identidad':
        return (
          <div className="form-grid">
            <label>
              Nombre
              <input type="text" {...register('persona.firstName')} disabled={!canEdit} />
              {errors.persona?.firstName && (
                <span className="error">{errors.persona.firstName.message}</span>
              )}
            </label>
            <label>
              Apellido
              <input type="text" {...register('persona.lastName')} disabled={!canEdit} />
              {errors.persona?.lastName && <span className="error">{errors.persona.lastName.message}</span>}
            </label>
            <label>
              Sexo
              <select {...register('persona.sex')} disabled={!canEdit}>
                {sexOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.persona?.sex && <span className="error">{errors.persona.sex.message}</span>}
            </label>
            <label>
              Fecha de nacimiento
              <input type="date" {...register('persona.birthdate')} disabled={!canEdit} />
              {errors.persona?.birthdate && (
                <span className="error">{errors.persona.birthdate.message}</span>
              )}
            </label>
            <label>
              Edad
              <input type="text" value={ageValue} readOnly className="muted" />
            </label>
            <label>
              Tipo de documento
              <select {...register('persona.documentType')} disabled={!canEdit}>
                {documentTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Número de documento
              <input type="text" {...register('persona.documentName')} disabled={!canEdit} />
              {errors.persona?.documentName && (
                <span className="error">{errors.persona.documentName.message}</span>
              )}
            </label>
            <label>
              Nacionalidad
              <select {...register('persona.nationality')} disabled={!canEdit}>
                {nationalityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {nationalityValue === 'OTRO' && (
              <label className="full">
                Especificar nacionalidad
                <input type="text" {...register('persona.otherNationality')} disabled={!canEdit} />
                {errors.persona?.otherNationality && (
                  <span className="error">{errors.persona.otherNationality.message}</span>
                )}
              </label>
            )}
          </div>
        );
      case 'contacto':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0 }}>Correos electrónicos</h4>
              {emailFields.length === 0 && <p className="muted">No hay correos cargados.</p>}
              {emailFields.map((field, index) => (
                <div
                  key={field.id}
                  style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                  <label style={{ flex: '1 1 240px' }}>
                    Correo #{index + 1}
                    <input
                      type="email"
                      {...register(`persona.emails.${index}.value` as const)}
                      disabled={!canEdit}
                    />
                    {errors.persona?.emails?.[index]?.value && (
                      <span className="error">{errors.persona.emails[index]?.value?.message}</span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => removeEmail(index)}
                    disabled={!canEdit}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => appendEmail({ value: '' })}
                  disabled={!canEdit}
                >
                  + Agregar correo
                </button>
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0 }}>Teléfonos</h4>
              {phoneFields.length === 0 && <p className="muted">No hay teléfonos cargados.</p>}
              {phoneFields.map((field, index) => (
                <div
                  key={field.id}
                  style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
                >
                  <label style={{ flex: '1 1 240px' }}>
                    Teléfono #{index + 1}
                    <input
                      type="text"
                      {...register(`persona.phones.${index}.value` as const)}
                      disabled={!canEdit}
                    />
                    {errors.persona?.phones?.[index]?.value && (
                      <span className="error">{errors.persona.phones[index]?.value?.message}</span>
                    )}
                  </label>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => removePhone(index)}
                    disabled={!canEdit}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => appendPhone({ value: '' })}
                  disabled={!canEdit}
                >
                  + Agregar teléfono
                </button>
              </div>
            </section>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0 }}>Redes sociales</h4>
              {socialFields.length === 0 && <p className="muted">No hay redes sociales cargadas.</p>}
              {socialFields.map((field, index) => (
                <div
                  key={field.id}
                  style={{
                    border: '1px solid var(--gray-700)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div
                    className="form-grid"
                    style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
                  >
                    <label>
                      Red social
                      <input
                        type="text"
                        placeholder="Ej: Twitter"
                        {...register(`persona.socialNetworks.${index}.network` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.socialNetworks?.[index]?.network && (
                        <span className="error">
                          {errors.persona.socialNetworks?.[index]?.network?.message}
                        </span>
                      )}
                    </label>
                    <label>
                      Identificador
                      <input
                        type="text"
                        placeholder="Usuario, enlace, etc."
                        {...register(`persona.socialNetworks.${index}.handle` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.socialNetworks?.[index]?.handle && (
                        <span className="error">
                          {errors.persona.socialNetworks?.[index]?.handle?.message}
                        </span>
                      )}
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn ghost danger"
                      onClick={() => removeSocialNetwork(index)}
                      disabled={!canEdit}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              <div>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => appendSocialNetwork({ network: '', handle: '' })}
                  disabled={!canEdit}
                >
                  + Agregar red social
                </button>
              </div>
            </section>

            <label className="full">
              Observaciones
              <textarea rows={4} {...register('persona.notes')} disabled={!canEdit} />
              {errors.persona?.notes && <span className="error">{errors.persona.notes.message}</span>}
            </label>
          </div>
        );
      case 'domicilio':
        return (
          <div className="form-grid">
            <label>
              Calle
              <input type="text" {...register('persona.street')} disabled={!canEdit} />
              {errors.persona?.street && <span className="error">{errors.persona.street.message}</span>}
            </label>
            <label>
              Número
              <input type="text" {...register('persona.streetNumber')} disabled={!canEdit} />
              {errors.persona?.streetNumber && (
                <span className="error">{errors.persona.streetNumber.message}</span>
              )}
            </label>
            <label>
              Provincia
              <input type="text" {...register('persona.province')} disabled={!canEdit} />
              {errors.persona?.province && <span className="error">{errors.persona.province.message}</span>}
            </label>
            <label>
              Localidad
              <input type="text" {...register('persona.locality')} disabled={!canEdit} />
              {errors.persona?.locality && <span className="error">{errors.persona.locality.message}</span>}
            </label>
            <label className="full">
              Referencia
              <textarea rows={3} {...register('persona.reference')} disabled={!canEdit} />
              {errors.persona?.reference && <span className="error">{errors.persona.reference.message}</span>}
            </label>
          </div>
        );
      case 'judicial':
        return (
          <div className="form-grid">
            <label>
              N° de causa
              <input type="text" {...register('numeroCausa')} disabled={!canEdit} />
              {errors.numeroCausa && <span className="error">{errors.numeroCausa.message}</span>}
            </label>
            <label>
              Carátula
              <input type="text" {...register('caratula')} disabled={!canEdit} />
              {errors.caratula && <span className="error">{errors.caratula.message}</span>}
            </label>
            <label>
              Juzgado interventor
              <input type="text" {...register('juzgadoInterventor')} disabled={!canEdit} />
              {errors.juzgadoInterventor && (
                <span className="error">{errors.juzgadoInterventor.message}</span>
              )}
            </label>
            <label>
              Secretaría
              <input type="text" {...register('secretaria')} disabled={!canEdit} />
              {errors.secretaria && <span className="error">{errors.secretaria.message}</span>}
            </label>
            <label>
              Fiscalía
              <input type="text" {...register('fiscalia')} disabled={!canEdit} />
              {errors.fiscalia && <span className="error">{errors.fiscalia.message}</span>}
            </label>
            <label>
              Jurisdicción
              <select {...register('jurisdiccion')} disabled={!canEdit}>
                {jurisdiccionOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Delito imputado
              <input type="text" {...register('delito')} disabled={!canEdit} />
              {errors.delito && <span className="error">{errors.delito.message}</span>}
            </label>
            <label>
              Fecha del hecho
              <input type="date" {...register('fechaHecho')} disabled={!canEdit} />
              {errors.fechaHecho && <span className="error">{errors.fechaHecho.message}</span>}
            </label>
            <label>
              Estado del requerimiento
              <select {...register('estadoRequerimiento')} disabled={!canEdit}>
                {estadoRequerimientoOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
              {errors.estadoRequerimiento && (
                <span className="error">{errors.estadoRequerimiento.message}</span>
              )}
            </label>
            <label>
              Fuerza interviniente
              <select {...register('fuerzaAsignada')} disabled={!canEdit}>
                {fuerzaIntervinienteOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.fuerzaAsignada && <span className="error">{errors.fuerzaAsignada.message}</span>}
            </label>
            <label>
              Recompensa
              <select {...register('recompensa')} disabled={!canEdit}>
                {recompensaOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
              {errors.recompensa && <span className="error">{errors.recompensa.message}</span>}
            </label>
            {recompensaValue === 'SI' && (
              <label>
                Monto de recompensa (ARS)
                <input type="text" {...register('rewardAmount')} disabled={!canEdit} />
                {errors.rewardAmount && <span className="error">{errors.rewardAmount.message}</span>}
              </label>
            )}
          </div>
        );
      case 'informacion':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {additionalInfoFields.length === 0 && (
              <p className="muted">No hay información complementaria cargada.</p>
            )}
            {additionalInfoFields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  border: '1px solid var(--gray-700)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div
                  className="form-grid"
                  style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                >
                  <label>
                    Nombre del campo
                    <input
                      type="text"
                      {...register(`additionalInfo.${index}.label` as const)}
                      disabled={!canEdit}
                    />
                    {errors.additionalInfo?.[index]?.label && (
                      <span className="error">
                        {errors.additionalInfo?.[index]?.label?.message}
                      </span>
                    )}
                  </label>
                  <label className="full">
                    Valor
                    <textarea
                      rows={3}
                      {...register(`additionalInfo.${index}.value` as const)}
                      disabled={!canEdit}
                    />
                    {errors.additionalInfo?.[index]?.value && (
                      <span className="error">
                        {errors.additionalInfo?.[index]?.value?.message}
                      </span>
                    )}
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => removeAdditionalInfo(index)}
                    disabled={!canEdit}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => appendAdditionalInfo({ label: '', value: '' })}
                disabled={!canEdit}
              >
                + Agregar campo
              </button>
            </div>
          </div>
        );
      case 'fotos':
        if (!editingCase?.id) {
          return <p className="muted">Guarda primero el caso para habilitar la carga de fotos.</p>;
        }

        return (
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <form className="form-grid" onSubmit={handlePhotoUpload}>
              <label className="full">
                Seleccionar archivo
                <input
                  type="file"
                  accept="image/*"
                  ref={photoInputRef}
                  onChange={handlePhotoFileChange}
                  disabled={!canEdit || photoUploadMutation.isPending}
                />
              </label>
              <label className="full">
                Descripción (máx. 200 caracteres)
                <input
                  type="text"
                  value={photoFormDescription}
                  onChange={(event) => setPhotoFormDescription(event.target.value.slice(0, 200))}
                  disabled={!canEdit || photoUploadMutation.isPending}
                />
              </label>
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={!canEdit || !photoFormFile || photoUploadMutation.isPending}
                >
                  {photoUploadMutation.isPending ? 'Subiendo…' : 'Subir foto'}
                </button>
              </div>
            </form>

            {photos.length === 0 ? (
              <p className="muted">No hay fotos asociadas al caso.</p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
                }}
              >
                {photos.map((photo) => {
                  const descriptionValue = photoDescriptions[photo.id] ?? '';
                  const isDeleting =
                    photoDeleteMutation.variables?.photoId === photo.id && photoDeleteMutation.isPending;
                  return (
                    <article key={photo.id} className="card" style={{ padding: '1rem' }}>
                      <div
                        style={{
                          borderRadius: '0.75rem',
                          overflow: 'hidden',
                          marginBottom: '0.75rem',
                          background: '#f4f6fb'
                        }}
                      >
                        <img
                          src={photo.url}
                          alt={photo.description ?? defaultPhotoDescription}
                          style={{ width: '100%', height: '180px', objectFit: 'cover' }}
                        />
                      </div>
                      <label className="full" style={{ display: 'block' }}>
                        Descripción
                        <input
                          type="text"
                          value={descriptionValue}
                          maxLength={200}
                          onChange={(event) =>
                            handlePhotoDescriptionInput(photo.id, event.target.value)
                          }
                          onBlur={() => commitPhotoDescription(photo)}
                          disabled={!canEdit || photoDescriptionMutation.isPending}
                        />
                      </label>
                      <p className="muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                        {photo.originalName} · {new Date(photo.uploadedAt).toLocaleString()}
                      </p>
                      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                        <a className="btn ghost" href={photo.url} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            editingCase?.id &&
                            photoDeleteMutation.mutate({ caseId: editingCase.id, photoId: photo.id })
                          }
                          disabled={!canEdit || isDeleting}
                        >
                          {isDeleting ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      case 'documentos':
        if (!editingCase?.id) {
          return <p className="muted">Guarda primero el caso para adjuntar documentos.</p>;
        }

        return (
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <form className="form-grid" onSubmit={handleDocumentUpload}>
              <label className="full">
                Seleccionar archivo
                <input
                  type="file"
                  ref={documentInputRef}
                  onChange={handleDocumentFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.odt,.ods,image/*"
                  disabled={!canEdit || documentUploadMutation.isPending}
                />
              </label>
              <label className="full">
                Descripción (máx. 200 caracteres)
                <input
                  type="text"
                  value={documentFormDescription}
                  onChange={(event) =>
                    setDocumentFormDescription(event.target.value.slice(0, 200))
                  }
                  disabled={!canEdit || documentUploadMutation.isPending}
                />
              </label>
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={!canEdit || !documentFormFile || documentUploadMutation.isPending}
                >
                  {documentUploadMutation.isPending ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </form>

            {documents.length === 0 ? (
              <p className="muted">No hay documentos adjuntos.</p>
            ) : (
              <div className="records-list" style={{ gap: '1rem' }}>
                {documents.map((document) => {
                  const descriptionValue = documentDescriptions[document.id] ?? '';
                  const isDeleting =
                    documentDeleteMutation.variables?.documentId === document.id &&
                    documentDeleteMutation.isPending;
                  return (
                    <article key={document.id} className="record-item" style={{ gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <strong>{document.originalName}</strong>
                        <p className="muted" style={{ fontSize: '0.75rem' }}>
                          {document.mimeType} · {(document.size / 1024).toFixed(1)} KB ·{' '}
                          {new Date(document.uploadedAt).toLocaleString()}
                        </p>
                        <label className="full" style={{ display: 'block' }}>
                          Descripción
                          <input
                            type="text"
                            value={descriptionValue}
                            maxLength={200}
                            onChange={(event) =>
                              handleDocumentDescriptionInput(document.id, event.target.value)
                            }
                            onBlur={() => commitDocumentDescription(document)}
                            disabled={!canEdit || documentDescriptionMutation.isPending}
                          />
                        </label>
                      </div>
                      <div className="actions" style={{ gap: '0.5rem' }}>
                        <a className="btn ghost" href={document.url} target="_blank" rel="noreferrer">
                          Descargar
                        </a>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            editingCase?.id &&
                            documentDeleteMutation.mutate({
                              caseId: editingCase.id,
                              documentId: document.id
                            })
                          }
                          disabled={!canEdit || isDeleting}
                        >
                          {isDeleting ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="page">
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h2>Casos</h2>
          <p>Gestiona los expedientes de investigación y los datos asociados a cada persona.</p>
        </div>
        <button className="btn primary" type="button" onClick={handleStartCreate} disabled={!canEdit}>
          + Nuevo caso
        </button>
      </div>

      {showForm && (
        <section className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="form" style={{ gap: '1.5rem' }}>
            <div className="tabs-container">
              <div className="tabs-header">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`tab-button ${activeTab === tab.id ? 'active' : ''} ${hasTabErrors(tab.id) ? 'has-errors' : ''}`}
                  >
                    <span className="tab-label">
                      {tab.label}
                      {hasTabErrors(tab.id) && <span className="error-indicator">!</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div role="tabpanel" className="tab-panel">
              {renderActiveTab()}
            </div>

            <div className="form-actions" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn ghost" onClick={handleCancelForm} disabled={formBusy}>
                Cancelar
              </button>
              <button className="btn primary" type="submit" disabled={formBusy || !canEdit}>
                {formBusy ? 'Guardando...' : editingCase ? 'Actualizar caso' : 'Crear caso'}
              </button>
            </div>
          </form>
        </section>
      )}

      {!showForm && (
        <>
          <section className="card">
            <h3>Filtrar casos</h3>
            <div
              className="form-grid"
              style={{
                display: 'grid',
                gap: '1rem',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'
              }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Búsqueda
                <input
                  type="text"
                  placeholder="Número de causa, carátula o persona"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Estado
                <select
                  value={estadoFilter}
                  onChange={(event) =>
                    setEstadoFilter(event.target.value as 'TODOS' | EstadoRequerimiento)
                  }
                >
                  <option value="TODOS">Todos los estados</option>
                  {estadoRequerimientoOptions.map((option) => (
                    <option key={option} value={option}>
                      {translateEstado(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Jurisdicción
                <select
                  value={jurisdiccionFilter}
                  onChange={(event) =>
                    setJurisdiccionFilter(
                      event.target.value as 'TODAS' | CaseFormValues['jurisdiccion']
                    )
                  }
                >
                  <option value="TODAS">Todas las jurisdicciones</option>
                  {jurisdiccionOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatOptionText(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                Fuerza asignada
                <select
                  value={fuerzaFilter}
                  onChange={(event) =>
                    setFuerzaFilter(
                      event.target.value as 'TODAS' | CaseFormValues['fuerzaAsignada']
                    )
                  }
                >
                  <option value="TODAS">Todas las fuerzas</option>
                  {fuerzaIntervinienteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSearchTerm('');
                  setEstadoFilter('TODOS');
                  setJurisdiccionFilter('TODAS');
                  setFuerzaFilter('TODAS');
                }}
                disabled={
                  !searchTerm && estadoFilter === 'TODOS' && jurisdiccionFilter === 'TODAS' && fuerzaFilter === 'TODAS'
                }
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          <section className="card">
            <h3>Casos cargados</h3>
            {casesQuery.isLoading && <p>Cargando casos...</p>}
            {casesQuery.isError && <p className="error">No se pudo cargar el listado.</p>}
            {!casesQuery.isLoading && handledCases.length === 0 && <p>No hay casos registrados.</p>}
            {handledCases.length > 0 && filteredCases.length === 0 && (
              <p>No se encontraron casos con los filtros seleccionados.</p>
            )}
            {filteredCases.length > 0 && (
              <div className="records-list">
                {filteredCases.map((item) => {
                  const phoneList = collectContactList(item.persona?.phone ?? null, item.persona?.phones);
                  const emailList = collectContactList(item.persona?.email ?? null, item.persona?.emails);
                  const socialList = collectSocialList(item.persona?.socialNetworks);

                return (
                  <article key={item.id} className="record-item">
                    <header>
                      <div>
                        <h4>{item.numeroCausa ?? 'Caso sin número'}</h4>
                        <p className="muted">
                          Estado: {translateEstado(item.estadoRequerimiento)} | Fuerza: {item.fuerzaAsignada ?? 'S/D'}
                        </p>
                        <p className="muted">
                          Jurisdicción: {formatOptionText(item.jurisdiccion)} | Carátula: {item.caratula ?? 'Sin dato'}
                        </p>
                      </div>
                      <div className="actions">
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => {
                            setEditingCase(item);
                            setShowForm(true);
                          }}
                          disabled={!canEdit}
                        >
                          Editar
                        </button>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() =>
                            window.confirm('¿Eliminar caso?') && deleteMutation.mutate(item.id)
                          }
                          disabled={!canEdit || deleteMutation.isPending}
                        >
                          Eliminar
                        </button>
                      </div>
                    </header>
                    <p className="muted">
                      Fecha del hecho: {item.fechaHecho ? new Date(item.fechaHecho).toLocaleDateString() : 'Sin dato'}
                    </p>
                    <p className="muted">
                      Recompensa: {formatOptionText(item.recompensa)}{' '}
                      {item.recompensa === 'SI' && item.rewardAmount ? `· $${item.rewardAmount}` : ''}
                    </p>
                    <p className="muted">
                      Archivos: {item.photos.length} foto(s) · {item.documents.length} documento(s)
                    </p>
                    {item.persona ? (
                      <div className="details-list">
                        <div>
                          <strong>
                            {item.persona.firstName} {item.persona.lastName}
                          </strong>{' '}
                          {item.persona.sex && <span className="tag">{item.persona.sex}</span>}
                          {item.persona.documentType && (
                            <span className="tag">
                              {item.persona.documentType}
                              {item.persona.documentName ? ` • ${item.persona.documentName}` : ''}
                            </span>
                          )}
                          {item.persona.birthdate && (
                            <span className="tag">
                              {new Date(item.persona.birthdate).toLocaleDateString()} ({
                                item.persona.age ?? computeAge(item.persona.birthdate)
                              } años)
                            </span>
                          )}
                        </div>
                        <p className="muted">{formatPersonSummary(item.persona)}</p>
                        {phoneList.length > 0 && (
                          <p className="muted">Teléfonos: {phoneList.join(' · ')}</p>
                        )}
                        {emailList.length > 0 && (
                          <p className="muted">Emails: {emailList.join(' · ')}</p>
                        )}
                        {socialList.length > 0 && (
                          <p className="muted">Redes: {socialList.join(' · ')}</p>
                        )}
                        {item.persona.notes && <p className="muted">Notas: {item.persona.notes}</p>}
                      </div>
                    ) : (
                      <p className="muted">Sin persona asociada.</p>
                    )}
                    <p className="muted">
                      Creado: {new Date(item.creadoEn).toLocaleString()} | Actualizado:{' '}
                      {new Date(item.actualizadoEn).toLocaleString()}
                    </p>
                  </article>
                );
                );
              })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default CasesPage;
