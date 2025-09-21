import fs from 'node:fs/promises';
import path from 'node:path';
import type { Express } from 'express';
import { CaseMediaKind, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import {
  AdditionalInfoInput,
  CasePersonInput,
  CreateCaseInput,
  UpdateCaseInput
} from './cases.schemas';
import { uploadsStaticPath } from '../../middleware/uploads';

const caseInclude = {
  personas: {
    include: {
      person: true,
      offenses: true
    }
  },
  media: true
} satisfies Prisma.CaseInclude;

type CaseWithRelations = Prisma.CaseGetPayload<{ include: typeof caseInclude }>;

const toISO = (value?: Date | null) => (value ? value.toISOString() : null);

const computeAge = (birthdate?: Date | null) => {
  if (!birthdate) return null;
  const diff = Date.now() - birthdate.getTime();
  if (diff <= 0) return 0;
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const toPublicPath = (relativePath: string) => `/uploads/${relativePath}`;

const serializeMedia = (item: CaseWithRelations['media'][number]) => ({
  id: item.id,
  kind: item.kind,
  description: item.description ?? null,
  url: toPublicPath(item.filePath),
  originalName: item.originalName,
  mimeType: item.mimeType,
  size: item.size,
  uploadedAt: item.uploadedAt.toISOString(),
  isPrimary: item.isPrimary ?? false
});

type AdditionalInfoItem = { label: string; value: string };
type ContactValueEntry = { value: string };
type SocialNetworkEntry = { network: string; handle: string };

const ADDITIONAL_INFO_LABEL_LIMIT = 120;
const ADDITIONAL_INFO_VALUE_LIMIT = 1000;
const CONTACT_EMAIL_LIMIT = 255;
const CONTACT_PHONE_LIMIT = 50;
const SOCIAL_NETWORK_LIMIT = 60;
const SOCIAL_HANDLE_LIMIT = 120;

const sanitizeAdditionalInfo = (items?: AdditionalInfoInput[]) => {
  if (items === undefined) {
    return undefined;
  }

  const trimmed = items
    .map((item) => ({
      label: item.label.trim().slice(0, ADDITIONAL_INFO_LABEL_LIMIT),
      value: item.value.trim().slice(0, ADDITIONAL_INFO_VALUE_LIMIT)
    }))
    .filter((item) => item.label.length > 0 && item.value.length > 0);

  return trimmed;
};

const parseAdditionalInfo = (value: Prisma.JsonValue | null): AdditionalInfoItem[] => {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const parsed: AdditionalInfoItem[] = [];
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const candidate = item as Record<string, unknown>;
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
    const valueText = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!label || !valueText) return;
    parsed.push({
      label: label.slice(0, ADDITIONAL_INFO_LABEL_LIMIT),
      value: valueText.slice(0, ADDITIONAL_INFO_VALUE_LIMIT)
    });
  });
  return parsed;
};

const sanitizeValueEntries = (
  entries: Array<{ value?: string | null | undefined }> | undefined,
  transform?: (raw: string) => string,
  maxLength: number = CONTACT_EMAIL_LIMIT
) => {
  if (entries === undefined) {
    return undefined;
  }

  const sanitized: ContactValueEntry[] = entries
    .map((entry) => {
      const raw = (entry.value ?? '').trim();
      if (!raw) return null;
      const transformed = transform ? transform(raw) : raw;
      return { value: transformed.slice(0, maxLength) };
    })
    .filter((entry): entry is ContactValueEntry => entry !== null);

  return sanitized;
};

const sanitizeSocialNetworkEntries = (
  entries: Array<{ network?: string | null; handle?: string | null }> | undefined
) => {
  if (entries === undefined) {
    return undefined;
  }

  const sanitized: SocialNetworkEntry[] = entries
    .map((entry) => {
      const network = (entry.network ?? '').trim();
      const handle = (entry.handle ?? '').trim();
      if (!network || !handle) return null;
      return {
        network: network.slice(0, SOCIAL_NETWORK_LIMIT),
        handle: handle.slice(0, SOCIAL_HANDLE_LIMIT)
      };
    })
    .filter((entry): entry is SocialNetworkEntry => entry !== null);

  return sanitized;
};

const parseContactValueEntries = (
  value: Prisma.JsonValue | null,
  maxLength: number
): ContactValueEntry[] => {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const parsed: ContactValueEntry[] = [];
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const candidate = item as Record<string, unknown>;
    const raw = typeof candidate.value === 'string' ? candidate.value.trim() : '';
    if (!raw) return;
    parsed.push({ value: raw.slice(0, maxLength) });
  });
  return parsed;
};

const parseSocialNetworkEntries = (value: Prisma.JsonValue | null): SocialNetworkEntry[] => {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const parsed: SocialNetworkEntry[] = [];
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const candidate = item as Record<string, unknown>;
    const network = typeof candidate.network === 'string' ? candidate.network.trim() : '';
    const handle = typeof candidate.handle === 'string' ? candidate.handle.trim() : '';
    if (!network || !handle) return;
    parsed.push({
      network: network.slice(0, SOCIAL_NETWORK_LIMIT),
      handle: handle.slice(0, SOCIAL_HANDLE_LIMIT)
    });
  });
  return parsed;
};

const serializeCase = (record: CaseWithRelations) => {
  const persona = record.personas[0];
  const rewardAmount = record.rewardAmount ? record.rewardAmount.toString() : null;
  const photos = record.media.filter((media) => media.kind === 'PHOTO').map(serializeMedia);
  const documents = record.media.filter((media) => media.kind === 'DOCUMENT').map(serializeMedia);
  const emailEntries = persona
    ? parseContactValueEntries(persona.person.emails ?? null, CONTACT_EMAIL_LIMIT)
    : [];
  const phoneEntries = persona
    ? parseContactValueEntries(persona.person.phones ?? null, CONTACT_PHONE_LIMIT)
    : [];
  const socialEntries = persona ? parseSocialNetworkEntries(persona.person.socialNetworks ?? null) : [];
  const primaryEmail = persona?.person.email ?? emailEntries[0]?.value ?? null;
  const primaryPhone = persona?.person.phone ?? phoneEntries[0]?.value ?? null;
  return {
    id: record.id,
    numeroCausa: record.numeroCausa,
    caratula: record.caratula,
    juzgadoInterventor: record.juzgadoInterventor,
    secretaria: record.secretaria,
    fiscalia: record.fiscalia,
    jurisdiccion: record.jurisdiccion,
    delito: record.delito,
    fechaHecho: toISO(record.fechaHecho),
    estadoRequerimiento: record.estadoRequerimiento,
    fuerzaAsignada: record.fuerzaAsignada,
    recompensa: record.recompensa,
    rewardAmount,
    creadoEn: record.creadoEn.toISOString(),
    actualizadoEn: record.actualizadoEn.toISOString(),
    additionalInfo: parseAdditionalInfo(record.additionalInfo ?? null),
    photos,
    documents,
    persona: persona
      ? {
          id: persona.person.id,
          firstName: persona.person.firstName ?? '',
          lastName: persona.person.lastName ?? '',
          sex: persona.person.sex ?? null,
          identityNumber: persona.person.identityNumber ?? null,
          documentType: persona.person.documentType ?? null,
          documentName: persona.person.documentName ?? null,
          birthdate: toISO(persona.person.birthdate),
          age: computeAge(persona.person.birthdate),
          email: primaryEmail,
          phone: primaryPhone,
          emails: emailEntries,
          phones: phoneEntries,
          socialNetworks: socialEntries,
          notes: persona.person.notes ?? null,
          nationality: persona.person.nationality,
          otherNationality: persona.person.otherNationality ?? null,
          street: persona.person.street ?? null,
          streetNumber: persona.person.streetNumber ?? null,
          province: persona.person.province ?? null,
          locality: persona.person.locality ?? null,
          reference: persona.person.reference ?? null
        }
      : null
  };
};

const buildFechaHecho = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Fecha inválida', 400, true);
  }
  return date;
};

const parseBirthdate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Fecha de nacimiento inválida', 400, true);
  }
  return date;
};

const normalize = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeDescription = (value: string | undefined, fallback: string, maxLength: number) => {
  const normalized = normalize(value) ?? fallback;
  return normalized.slice(0, maxLength);
};

const ensureCaseExists = async (caseId: string) => {
  const exists = await prisma.case.findUnique({ where: { id: caseId } });
  if (!exists) {
    throw new AppError('Caso no encontrado', 404, true);
  }
  return exists.id;
};

const relativeFromUploads = (absolutePath: string) => {
  const relative = path.relative(uploadsStaticPath, absolutePath);
  if (!relative || relative.startsWith('..')) {
    throw new AppError('No se pudo resolver la ubicación del archivo', 500, true);
  }
  return relative.split(path.sep).join('/');
};

const removePhysicalFile = async (relativePath: string) => {
  const absolute = path.join(uploadsStaticPath, relativePath);
  try {
    await fs.unlink(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
};

const ensurePerson = async (
  tx: Prisma.TransactionClient,
  input: Partial<CasePersonInput>,
  fallbackPersonId?: string
) => {
  const sanitizedEmailEntries = sanitizeValueEntries(input.emails, (value) => value.toLowerCase(), CONTACT_EMAIL_LIMIT);
  const sanitizedPhoneEntries = sanitizeValueEntries(input.phones, undefined, CONTACT_PHONE_LIMIT);
  const sanitizedSocialEntries = sanitizeSocialNetworkEntries(input.socialNetworks);

  const updateData: Prisma.PersonUpdateInput = {};

  if (input.firstName !== undefined) {
    updateData.firstName = input.firstName.trim();
  }

  if (input.lastName !== undefined) {
    updateData.lastName = input.lastName.trim();
  }

  if (input.identityNumber !== undefined) {
    updateData.identityNumber = normalize(input.identityNumber) ?? null;
  }

  if (input.sex !== undefined) {
    updateData.sex = input.sex;
  }

  if (input.documentType !== undefined) {
    updateData.documentType = input.documentType ?? null;
  }

  if (input.documentName !== undefined) {
    updateData.documentName = normalize(input.documentName) ?? null;
  }

  if (input.birthdate !== undefined) {
    updateData.birthdate = input.birthdate ? parseBirthdate(input.birthdate) : null;
  }

  if (input.emails !== undefined) {
    const emails = sanitizedEmailEntries ?? [];
    updateData.emails = emails;
    updateData.email = emails.length > 0 ? emails[0].value : null;
  } else if (input.email !== undefined) {
    const normalizedEmail = normalize(input.email)?.toLowerCase();
    updateData.email = normalizedEmail ?? null;
    updateData.emails = normalizedEmail ? [{ value: normalizedEmail }] : [];
  }

  if (input.phones !== undefined) {
    const phones = sanitizedPhoneEntries ?? [];
    updateData.phones = phones;
    updateData.phone = phones.length > 0 ? phones[0].value : null;
  } else if (input.phone !== undefined) {
    const normalizedPhone = normalize(input.phone);
    updateData.phone = normalizedPhone ?? null;
    updateData.phones = normalizedPhone ? [{ value: normalizedPhone }] : [];
  }

  if (input.socialNetworks !== undefined) {
    updateData.socialNetworks = sanitizedSocialEntries ?? [];
  }

  if (input.notes !== undefined) {
    updateData.notes = normalize(input.notes) ?? null;
  }

  if (input.nationality !== undefined) {
    updateData.nationality = input.nationality;
  }

  if (input.otherNationality !== undefined) {
    updateData.otherNationality = normalize(input.otherNationality) ?? null;
  }

  if (input.street !== undefined) {
    updateData.street = normalize(input.street) ?? null;
  }

  if (input.streetNumber !== undefined) {
    updateData.streetNumber = normalize(input.streetNumber) ?? null;
  }

  if (input.province !== undefined) {
    updateData.province = normalize(input.province) ?? null;
  }

  if (input.locality !== undefined) {
    updateData.locality = normalize(input.locality) ?? null;
  }

  if (input.reference !== undefined) {
    updateData.reference = normalize(input.reference) ?? null;
  }

  const explicitPersonId = input.personId ?? fallbackPersonId;
  if (explicitPersonId) {
    await tx.person.update({ where: { id: explicitPersonId }, data: updateData });
    return explicitPersonId;
  }

  if (input.identityNumber) {
    const existing = await tx.person.findUnique({ where: { identityNumber: input.identityNumber } });
    if (existing) {
      await tx.person.update({ where: { id: existing.id }, data: updateData });
      return existing.id;
    }
  }

  if (!input.firstName || !input.lastName) {
    throw new AppError('Nombre y apellido son obligatorios', 400, true);
  }

  const emailForCreate = sanitizedEmailEntries && sanitizedEmailEntries.length > 0
    ? sanitizedEmailEntries[0].value
    : normalize(input.email)?.toLowerCase();
  const phoneForCreate = sanitizedPhoneEntries && sanitizedPhoneEntries.length > 0
    ? sanitizedPhoneEntries[0].value
    : normalize(input.phone);
  const emailsData = sanitizedEmailEntries !== undefined
    ? sanitizedEmailEntries
    : emailForCreate
      ? [{ value: emailForCreate }]
      : [];
  const phonesData = sanitizedPhoneEntries !== undefined
    ? sanitizedPhoneEntries
    : phoneForCreate
      ? [{ value: phoneForCreate }]
      : [];
  const socialData = sanitizedSocialEntries !== undefined ? sanitizedSocialEntries : [];

  const created = await tx.person.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      identityNumber: normalize(input.identityNumber),
      sex: input.sex,
      documentType: input.documentType,
      documentName: normalize(input.documentName),
      birthdate: input.birthdate ? parseBirthdate(input.birthdate) : undefined,
      email: emailForCreate ?? null,
      emails: emailsData,
      phone: phoneForCreate ?? null,
      phones: phonesData,
      socialNetworks: socialData,
      notes: normalize(input.notes),
      nationality: input.nationality ?? 'ARGENTINA',
      otherNationality: normalize(input.otherNationality),
      street: normalize(input.street),
      streetNumber: normalize(input.streetNumber),
      province: normalize(input.province),
      locality: normalize(input.locality),
      reference: normalize(input.reference)
    }
  });

  return created.id;
};

const attachPersonToCase = async (
  tx: Prisma.TransactionClient,
  caseId: string,
  personId: string
) => {
  await tx.personCase.deleteMany({ where: { caseId } });

  await tx.personCase.create({
    data: {
      caseId,
      personId
    }
  });

  await tx.personCaseOffense.deleteMany({ where: { caseId, personId } });
};

export const listCases = async () => {
  const cases = await prisma.case.findMany({
    orderBy: { creadoEn: 'desc' },
    include: caseInclude
  });

  return cases.map(serializeCase);
};

export const getCaseById = async (id: string) => {
  const caseData = await prisma.case.findUnique({ where: { id }, include: caseInclude });
  if (!caseData) {
    throw new AppError('Caso no encontrado', 404, true);
  }
  return serializeCase(caseData);
};

export const createCase = async (input: CreateCaseInput) => {
  return prisma.$transaction(async (tx) => {
    const personId = await ensurePerson(tx, input.persona);
    const additionalInfo = sanitizeAdditionalInfo(input.additionalInfo);

    const created = await tx.case.create({
      data: {
        numeroCausa: normalize(input.numeroCausa),
        caratula: normalize(input.caratula),
        juzgadoInterventor: normalize(input.juzgadoInterventor),
        secretaria: normalize(input.secretaria),
        fiscalia: normalize(input.fiscalia),
        jurisdiccion: input.jurisdiccion ?? 'SIN_DATO',
        delito: normalize(input.delito),
        fechaHecho: buildFechaHecho(input.fechaHecho),
        estadoRequerimiento: input.estadoRequerimiento,
        fuerzaAsignada: input.fuerzaAsignada,
        recompensa: input.recompensa,
        rewardAmount:
          input.recompensa === 'SI' && input.rewardAmount
            ? new Prisma.Decimal(input.rewardAmount)
            : null,
        additionalInfo,
        personas: {
          create: {
            personId,
            rol: null
          }
        }
      },
      include: caseInclude
    });

    await attachPersonToCase(tx, created.id, personId);

    const refreshed = await tx.case.findUniqueOrThrow({ where: { id: created.id }, include: caseInclude });
    return serializeCase(refreshed);
  });
};

export const updateCase = async (id: string, input: UpdateCaseInput) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.case.findUnique({ where: { id }, include: caseInclude });
    if (!existing) {
      throw new AppError('Caso no encontrado', 404, true);
    }

    const resolvedRecompensa = input.recompensa ?? existing.recompensa;
    const additionalInfo = sanitizeAdditionalInfo(input.additionalInfo);

    await tx.case.update({
      where: { id },
      data: {
        numeroCausa: input.numeroCausa !== undefined ? normalize(input.numeroCausa) : undefined,
        caratula: input.caratula !== undefined ? normalize(input.caratula) : undefined,
        juzgadoInterventor:
          input.juzgadoInterventor !== undefined ? normalize(input.juzgadoInterventor) : undefined,
        secretaria: input.secretaria !== undefined ? normalize(input.secretaria) : undefined,
        fiscalia: input.fiscalia !== undefined ? normalize(input.fiscalia) : undefined,
        jurisdiccion: input.jurisdiccion ?? undefined,
        delito: input.delito !== undefined ? normalize(input.delito) : undefined,
        fechaHecho: input.fechaHecho !== undefined ? buildFechaHecho(input.fechaHecho) : undefined,
        estadoRequerimiento: input.estadoRequerimiento ?? undefined,
        fuerzaAsignada: input.fuerzaAsignada,
        recompensa: input.recompensa ?? undefined,
        rewardAmount:
          input.rewardAmount !== undefined
            ? resolvedRecompensa === 'SI' && input.rewardAmount
              ? new Prisma.Decimal(input.rewardAmount)
              : null
            : input.recompensa !== undefined && resolvedRecompensa !== 'SI'
              ? null
              : undefined,
        additionalInfo: input.additionalInfo !== undefined ? additionalInfo ?? [] : undefined
      }
    });

    if (input.persona) {
      const currentPersonId = existing.personas[0]?.person.id;
      const personId = await ensurePerson(tx, input.persona, currentPersonId);

      await attachPersonToCase(tx, id, personId);
    }

    const updated = await tx.case.findUniqueOrThrow({ where: { id }, include: caseInclude });
    return serializeCase(updated);
  });
};

export const deleteCase = async (id: string) => {
  try {
    const media = await prisma.caseMedia.findMany({ where: { caseId: id } });
    await prisma.case.delete({ where: { id } });
    await Promise.all(media.map((item) => removePhysicalFile(item.filePath).catch(() => undefined)));
  } catch (error) {
    throw new AppError('Caso no encontrado', 404, true);
  }
};

type UploadedFile = Express.Multer.File;

const createMediaRecord = async (
  caseId: string,
  kind: CaseMediaKind,
  file: UploadedFile,
  description: string,
  options?: { isPrimary?: boolean }
) => {
  const relativePath = relativeFromUploads(file.path);

  const created = await prisma.caseMedia.create({
    data: {
      caseId,
      kind,
      filePath: relativePath,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      description,
      isPrimary: options?.isPrimary ?? false
    }
  });

  return serializeMedia(created as CaseWithRelations['media'][number]);
};

export const addCasePhoto = async (caseId: string, file: UploadedFile, description?: string) => {
  await ensureCaseExists(caseId);
  const resolvedDescription = normalizeDescription(description, 'Foto del investigado', 200);
  const existingPrimary = await prisma.caseMedia.findFirst({
    where: { caseId, kind: CaseMediaKind.PHOTO, isPrimary: true }
  });
  return createMediaRecord(caseId, CaseMediaKind.PHOTO, file, resolvedDescription, {
    isPrimary: !existingPrimary
  });
};

export const addCaseDocument = async (caseId: string, file: UploadedFile, description?: string) => {
  await ensureCaseExists(caseId);
  const resolvedDescription = normalizeDescription(description, 'Documento adjunto', 200);
  return createMediaRecord(caseId, CaseMediaKind.DOCUMENT, file, resolvedDescription);
};

export const updateCaseMediaDescription = async (
  caseId: string,
  mediaId: string,
  description: string,
  expectedKind?: CaseMediaKind
) => {
  const record = await prisma.caseMedia.findFirst({ where: { id: mediaId, caseId } });
  if (!record) {
    throw new AppError('Archivo no encontrado', 404, true);
  }

  if (expectedKind && record.kind !== expectedKind) {
    throw new AppError('Tipo de archivo no coincide', 400, true);
  }

  const normalized = normalizeDescription(description, record.kind === 'PHOTO' ? 'Foto del investigado' : 'Documento adjunto', 200);

  const updated = await prisma.caseMedia.update({
    where: { id: mediaId },
    data: { description: normalized }
  });

  return serializeMedia(updated as CaseWithRelations['media'][number]);
};

export const removeCaseMedia = async (caseId: string, mediaId: string, expectedKind?: CaseMediaKind) => {
  const record = await prisma.caseMedia.findFirst({ where: { id: mediaId, caseId } });
  if (!record) {
    throw new AppError('Archivo no encontrado', 404, true);
  }

  if (expectedKind && record.kind !== expectedKind) {
    throw new AppError('Tipo de archivo no coincide', 400, true);
  }

  await prisma.caseMedia.delete({ where: { id: mediaId } });
  await removePhysicalFile(record.filePath);

  if (expectedKind === CaseMediaKind.PHOTO && record.isPrimary) {
    const nextPrimary = await prisma.caseMedia.findFirst({
      where: { caseId, kind: CaseMediaKind.PHOTO },
      orderBy: { uploadedAt: 'desc' }
    });

    if (nextPrimary) {
      await prisma.caseMedia.update({ where: { id: nextPrimary.id }, data: { isPrimary: true } });
    }
  }
};

export const setCasePrimaryPhoto = async (caseId: string, photoId: string) => {
  return prisma.$transaction(async (tx) => {
    const target = await tx.caseMedia.findFirst({
      where: { id: photoId, caseId, kind: CaseMediaKind.PHOTO }
    });

    if (!target) {
      throw new AppError('Foto no encontrada', 404, true);
    }

    await tx.caseMedia.updateMany({
      where: {
        caseId,
        kind: CaseMediaKind.PHOTO,
        isPrimary: true,
        NOT: { id: photoId }
      },
      data: { isPrimary: false }
    });

    const updated = await tx.caseMedia.update({
      where: { id: photoId },
      data: { isPrimary: true }
    });

    return serializeMedia(updated as CaseWithRelations['media'][number]);
  });
};
