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

type AddressEntry = {
  street?: string | null;
  streetNumber?: string | null;
  province?: string | null;
  locality?: string | null;
  reference?: string | null;
  isPrincipal?: boolean | null;
};

export const toAddressEntries = (
  addresses?: Array<AddressEntry | null> | null,
  fallbackAddress?: {
    street?: string | null;
    streetNumber?: string | null;
    province?: string | null;
    locality?: string | null;
    reference?: string | null;
  } | null
): Array<{ street: string; streetNumber: string; province: string; locality: string; reference: string; isPrincipal: boolean }> => {
  const list: Array<{ street: string; streetNumber: string; province: string; locality: string; reference: string; isPrincipal: boolean }> = [];

  (addresses ?? []).forEach((entry) => {
    if (!entry) return;
    list.push({
      street: entry.street ?? '',
      streetNumber: entry.streetNumber ?? '',
      province: entry.province ?? '',
      locality: entry.locality ?? '',
      reference: entry.reference ?? '',
      isPrincipal: entry.isPrincipal ?? false
    });
  });

  // Si no hay direcciones en el array pero hay datos de dirección en los campos legacy, agregar como dirección principal
  if (list.length === 0 && fallbackAddress) {
    const hasAnyAddressData = fallbackAddress.street || fallbackAddress.streetNumber ||
                             fallbackAddress.province || fallbackAddress.locality ||
                             fallbackAddress.reference;
    if (hasAnyAddressData) {
      list.push({
        street: fallbackAddress.street ?? '',
        streetNumber: fallbackAddress.streetNumber ?? '',
        province: fallbackAddress.province ?? '',
        locality: fallbackAddress.locality ?? '',
        reference: fallbackAddress.reference ?? '',
        isPrincipal: true
      });
    }
  }

  // Si no hay direcciones, agregar una dirección vacía
  if (list.length === 0) {
    list.push({ street: '', streetNumber: '', province: '', locality: '', reference: '', isPrincipal: true });
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
    addresses: toAddressEntries(record.persona?.addresses ?? null, {
      street: record.persona?.street,
      streetNumber: record.persona?.streetNumber,
      province: record.persona?.province,
      locality: record.persona?.locality,
      reference: record.persona?.reference
    }),
    nationality: record.persona?.nationality ?? 'ARGENTINA',
    otherNationality: record.persona?.otherNationality ?? ''
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

type AddressFormEntry = {
  street?: string;
  streetNumber?: string;
  province?: string;
  locality?: string;
  reference?: string;
  isPrincipal?: boolean;
};

const normalizeAddressEntries = (entries: Array<AddressFormEntry>) => {
  const filtered = entries.filter((entry) =>
    (entry.street ?? '').trim().length > 0 ||
    (entry.streetNumber ?? '').trim().length > 0 ||
    (entry.province ?? '').trim().length > 0 ||
    (entry.locality ?? '').trim().length > 0 ||
    (entry.reference ?? '').trim().length > 0
  );

  return filtered.map((entry) => ({
    street: (entry.street ?? '').trim().slice(0, 120),
    streetNumber: (entry.streetNumber ?? '').trim().slice(0, 20),
    province: (entry.province ?? '').trim().slice(0, 120),
    locality: (entry.locality ?? '').trim().slice(0, 120),
    reference: (entry.reference ?? '').trim().slice(0, 255),
    isPrincipal: entry.isPrincipal ?? false
  }));
};

export const buildPayload = (values: CaseFormValues) => {
  const normalizedEmails = normalizeEmailEntries(values.persona.emails);
  const normalizedPhones = normalizePhoneEntries(values.persona.phones);
  const normalizedSocialNetworks = normalizeSocialNetworkEntries(values.persona.socialNetworks);
  const normalizedAddresses = normalizeAddressEntries(values.persona.addresses);

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
      addresses: normalizedAddresses,
      notes: values.persona.notes?.trim() || "",
      nationality: values.persona.nationality,
      otherNationality:
        values.persona.nationality === 'OTRO'
          ? blankToUndefined(values.persona.otherNationality)
          : undefined,
      // Mantener campos legacy para compatibilidad - usar la dirección principal
      street: normalizedAddresses.find(addr => addr.isPrincipal)?.street || normalizedAddresses[0]?.street || undefined,
      streetNumber: normalizedAddresses.find(addr => addr.isPrincipal)?.streetNumber || normalizedAddresses[0]?.streetNumber || undefined,
      province: normalizedAddresses.find(addr => addr.isPrincipal)?.province || normalizedAddresses[0]?.province || undefined,
      locality: normalizedAddresses.find(addr => addr.isPrincipal)?.locality || normalizedAddresses[0]?.locality || undefined,
      reference: normalizedAddresses.find(addr => addr.isPrincipal)?.reference || normalizedAddresses[0]?.reference || undefined
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

  if (persona.addresses && persona.addresses.length > 0) {
    const principalAddress = persona.addresses.find(addr => addr.isPrincipal) || persona.addresses[0];
    const pieces: string[] = [];

    if (principalAddress.street || principalAddress.streetNumber) {
      pieces.push(`${principalAddress.street ?? 'S/D'} ${principalAddress.streetNumber ?? ''}`.trim());
    }
    if (principalAddress.locality || principalAddress.province) {
      pieces.push([principalAddress.locality, principalAddress.province].filter(Boolean).join(', '));
    }
    if (principalAddress.reference) {
      pieces.push(`Ref.: ${principalAddress.reference}`);
    }

    return pieces.length > 0 ? pieces.join(' · ') : 'Sin domicilio informado';
  }

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
