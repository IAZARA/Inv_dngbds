import type { CaseRecord, EstadoRequerimiento } from '../../types';
import type { CaseFormValues } from './formSchema';

export const blankToUndefined = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type ContactValueEntry = { value?: string | null };
type SocialNetworkEntry = { network?: string | null; handle?: string | null };

export const toValueEntries = (
  entries?: Array<ContactValueEntry | null> | null,
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

export const toSocialEntries = (
  entries?: Array<SocialNetworkEntry | null> | null
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

export const mapCaseToForm = (record: CaseRecord): CaseFormValues => ({
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
  rewardAmountStatus:
    record.recompensa === 'SI' && !record.rewardAmount ? 'UNKNOWN' : 'KNOWN',
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
  additionalInfo:
    record.additionalInfo?.map((entry) => ({
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

const normalizeEmailEntries = (entries: Array<ContactValueEntry>) => {
  return entries
    .map((entry) => (entry.value ?? '').trim().toLowerCase().slice(0, 255))
    .filter((value) => value.length > 0)
    .map((value) => ({ value }));
};

const normalizePhoneEntries = (entries: Array<ContactValueEntry>) => {
  return entries
    .map((entry) => (entry.value ?? '').trim().slice(0, 50))
    .filter((value) => value.length > 0)
    .map((value) => ({ value }));
};

const normalizeSocialNetworkEntries = (
  entries: Array<SocialNetworkEntry>
) => {
  return entries
    .map((entry) => ({
      network: (entry.network ?? '').trim().slice(0, 60),
      handle: (entry.handle ?? '').trim().slice(0, 120)
    }))
    .filter((entry) => entry.network.length > 0 && entry.handle.length > 0);
};

export const buildPayload = (values: CaseFormValues) => {
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
    rewardAmountStatus: values.recompensa === 'SI' ? values.rewardAmountStatus : 'KNOWN',
    rewardAmount:
      values.recompensa === 'SI'
        ? values.rewardAmountStatus === 'UNKNOWN'
          ? null
          : blankToUndefined(values.rewardAmount)
        : undefined,
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

export const computeAge = (dateString?: string) => {
  if (!dateString) return '';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return '';
  const diff = Date.now() - parsed.getTime();
  if (diff <= 0) return '';
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
};

export const formatPersonSummary = (persona: CaseRecord['persona']) => {
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

export const collectContactList = (
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

export const collectSocialList = (
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

export const formatOptionText = (text: string) => text.replace(/_/g, ' ');

export const translateEstado = (estado: EstadoRequerimiento) => {
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

export const translateFuerza = (fuerza: string) => {
  switch (fuerza) {
    case 'PFA':
      return 'Policía Federal';
    case 'GNA':
      return 'Gendarmería';
    case 'PSA':
      return 'Prefectura';
    case 'PNA':
      return 'Policía de Seguridad Aeroportuaria';
    case 'S/D':
      return 'S/D';
    default:
      return fuerza;
  }
};
