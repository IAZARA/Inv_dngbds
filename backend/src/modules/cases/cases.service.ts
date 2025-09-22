import fs from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import type { Express } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
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
type AddressEntry = { street: string; streetNumber: string; province: string; locality: string; reference: string; isPrincipal: boolean };

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

const sanitizeAddressEntries = (
  entries: Array<{ street?: string | null; streetNumber?: string | null; province?: string | null; locality?: string | null; reference?: string | null; isPrincipal?: boolean | null }> | undefined
) => {
  if (entries === undefined) {
    return undefined;
  }

  const sanitized: AddressEntry[] = entries
    .map((entry) => {
      const street = (entry.street ?? '').trim();
      const streetNumber = (entry.streetNumber ?? '').trim();
      const province = (entry.province ?? '').trim();
      const locality = (entry.locality ?? '').trim();
      const reference = (entry.reference ?? '').trim();

      // Solo incluir direcciones que tengan al menos un campo con contenido
      if (!street && !streetNumber && !province && !locality && !reference) return null;

      return {
        street: street.slice(0, 120),
        streetNumber: streetNumber.slice(0, 20),
        province: province.slice(0, 120),
        locality: locality.slice(0, 120),
        reference: reference.slice(0, 255),
        isPrincipal: entry.isPrincipal ?? false
      };
    })
    .filter((entry): entry is AddressEntry => entry !== null);

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

const parseAddressEntries = (value: Prisma.JsonValue | null): AddressEntry[] => {
  if (!value || !Array.isArray(value)) {
    return [];
  }

  const parsed: AddressEntry[] = [];
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) return;
    const candidate = item as Record<string, unknown>;
    const street = typeof candidate.street === 'string' ? candidate.street.trim() : '';
    const streetNumber = typeof candidate.streetNumber === 'string' ? candidate.streetNumber.trim() : '';
    const province = typeof candidate.province === 'string' ? candidate.province.trim() : '';
    const locality = typeof candidate.locality === 'string' ? candidate.locality.trim() : '';
    const reference = typeof candidate.reference === 'string' ? candidate.reference.trim() : '';
    const isPrincipal = typeof candidate.isPrincipal === 'boolean' ? candidate.isPrincipal : false;

    // Solo incluir direcciones que tengan al menos un campo con contenido
    if (!street && !streetNumber && !province && !locality && !reference) return;

    parsed.push({
      street: street.slice(0, 120),
      streetNumber: streetNumber.slice(0, 20),
      province: province.slice(0, 120),
      locality: locality.slice(0, 120),
      reference: reference.slice(0, 255),
      isPrincipal
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
  const addressEntries = persona ? parseAddressEntries(persona.person.addressesData ?? null) : [];
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
    estadoRequerimiento: record.estadoRequerimiento,
    fuerzaAsignada: record.fuerzaAsignada,
    recompensa: record.recompensa,
    rewardAmount,
    priorityValue: record.priorityValue,
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
          addresses: addressEntries,
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
  const sanitizedAddressEntries = sanitizeAddressEntries(input.addresses);

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

  if (input.addresses !== undefined) {
    updateData.addressesData = sanitizedAddressEntries ?? [];

    // Actualizar campos legacy usando la dirección principal
    const principalAddress = (sanitizedAddressEntries ?? []).find(addr => addr.isPrincipal) || (sanitizedAddressEntries ?? [])[0];
    if (principalAddress) {
      updateData.street = principalAddress.street || null;
      updateData.streetNumber = principalAddress.streetNumber || null;
      updateData.province = principalAddress.province || null;
      updateData.locality = principalAddress.locality || null;
      updateData.reference = principalAddress.reference || null;
    } else {
      // Si no hay direcciones en el array, limpiar los campos legacy
      updateData.street = null;
      updateData.streetNumber = null;
      updateData.province = null;
      updateData.locality = null;
      updateData.reference = null;
    }
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes && input.notes.trim() ? input.notes.trim() : null;
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
  const addressData = sanitizedAddressEntries !== undefined ? sanitizedAddressEntries : [];

  // Si hay direcciones múltiples, usar la principal o la primera para los campos legacy
  const principalAddress = addressData.find(addr => addr.isPrincipal) || addressData[0];

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
      addressesData: addressData,
      notes: normalize(input.notes),
      nationality: input.nationality ?? 'ARGENTINA',
      otherNationality: normalize(input.otherNationality),
      // Campos legacy para compatibilidad - usar la dirección principal
      street: principalAddress?.street || normalize(input.street),
      streetNumber: principalAddress?.streetNumber || normalize(input.streetNumber),
      province: principalAddress?.province || normalize(input.province),
      locality: principalAddress?.locality || normalize(input.locality),
      reference: principalAddress?.reference || normalize(input.reference)
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
    orderBy: [
      { priorityValue: { sort: 'desc', nulls: 'last' } },
      { creadoEn: 'desc' }
    ],
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

const translateEstadoLabel = (estado: string) => {
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

const formatEnum = (value: string) => value.replace(/_/g, ' ');

const summarizeAddress = (persona: ReturnType<typeof serializeCase>['persona']) => {
  if (!persona) return null;
  const pieces: string[] = [];
  if (persona.street || persona.streetNumber) {
    pieces.push(`${persona.street ?? ''} ${persona.streetNumber ?? ''}`.trim());
  }
  if (persona.locality || persona.province) {
    pieces.push([persona.locality, persona.province].filter(Boolean).join(', '));
  }
  if (persona.reference) {
    pieces.push(`Ref.: ${persona.reference}`);
  }
  return pieces.length > 0 ? pieces.join(' · ') : null;
};

const summarizeAllAddresses = (persona: ReturnType<typeof serializeCase>['persona']) => {
  if (!persona) return null;

  if (persona.addresses && persona.addresses.length > 0) {
    return persona.addresses
      .map((address) => {
        const parts = [address.street, address.streetNumber, address.locality, address.province]
          .filter(Boolean);
        let formattedAddress = parts.join(', ');

        if (address.isPrincipal) {
          formattedAddress = `[PRINCIPAL] ${formattedAddress}`;
        }

        if (address.reference) {
          formattedAddress += ` (Ref.: ${address.reference})`;
        }

        return formattedAddress;
      })
      .join(' | ');
  }

  return summarizeAddress(persona);
};

const removeDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const sanitizeCaseBaseName = (value: string) => {
  const normalized = removeDiacritics(value);
  const sanitized = normalized.replace(/[^A-Za-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
  return sanitized;
};

const buildCaseFileBaseName = (fullName?: string | null) => {
  const sanitized = sanitizeCaseBaseName(fullName ?? '');
  if (!sanitized) {
    return 'LEGAJO SIN PERSONA';
  }
  return `LEGAJO ${sanitized.toUpperCase()}`;
};

const buildCasePdfFileName = (fullName?: string | null) => `${buildCaseFileBaseName(fullName)}.pdf`;
const buildCaseZipFileName = (fullName?: string | null) => `${buildCaseFileBaseName(fullName)}.zip`;
const buildCaseExcelFileName = (fullName?: string | null) => `${buildCaseFileBaseName(fullName)}.xlsx`;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'application/rtf': '.rtf',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods'
};

export const generateCasePdf = async (id: string) => {
  const caseData = await getCaseById(id);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];

  const fullName = [caseData.persona?.firstName, caseData.persona?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const displayName = fullName || 'Sin persona asociada';
  const fileName = buildCasePdfFileName(fullName);

  // Encontrar la foto principal
  const primaryPhoto = caseData.photos.find((photo) => photo.isPrimary) || caseData.photos[0] || null;

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const { width, height } = doc.page;
  const contentWidth = width - doc.page.margins.left - doc.page.margins.right;

  // Marca de agua centrada
  doc.save();
  doc.font('Helvetica-Bold').fillColor('#ef4444').opacity(0.08);
  doc.rotate(-45, { origin: [width / 2, height / 2] });
  doc.fontSize(110).text('CONDIFENCIAL', -width / 2, height / 2 - 50, {
    align: 'center',
    width
  });
  doc.restore();
  doc.opacity(1);

  // Reset cursor so following content starts within the printable area
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;

  const drawDivider = () => {
    doc.moveDown(0.6);
    const y = doc.y;
    doc.lineWidth(0.6).strokeColor('#d1d5db');
    doc.moveTo(doc.page.margins.left, y).lineTo(width - doc.page.margins.right, y).stroke();
    doc.moveDown(0.4);
  };

  const drawSection = (title: string, entries: Array<{ label: string; value?: string | null }>) => {
    const items = entries.filter((entry) => {
      if (entry.value === undefined || entry.value === null) return false;
      return String(entry.value).trim().length > 0;
    });
    if (!items.length) return;

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f2937').text(title.toUpperCase());
    doc.moveDown(0.25);

    items.forEach((item) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#111827')
        .text(`${item.label}:`, { continued: true });
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#111827')
        .text(String(item.value), {
          width: contentWidth,
          align: 'left'
        });
      doc.moveDown(0.1);
    });
  };

  const drawListSection = (title: string, lines: string[]) => {
    const valid = lines.filter((line) => line.trim().length > 0);
    if (!valid.length) return;

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f2937').text(title.toUpperCase());
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(11).fillColor('#111827');
    valid.forEach((line) => {
      doc.text(`- ${line}`, {
        width: contentWidth,
        lineGap: 2,
        paragraphGap: 4
      });
    });
  };

  const drawAdditionalInfoSection = (title: string, entries: Array<{ label: string; value: string }>) => {
    const valid = entries.filter((entry) => entry.label.trim().length > 0 && entry.value.trim().length > 0);
    if (!valid.length) return;

    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1f2937').text(title.toUpperCase());
    doc.moveDown(0.25);

    valid.forEach((entry) => {
      doc.text('- ', { continued: true });
      doc.font('Helvetica-Bold').text(entry.label, { continued: true });
      doc.font('Helvetica').text(`: ${entry.value}`, {
        width: contentWidth,
        lineGap: 2,
        paragraphGap: 4
      });
    });
  };

  const formatDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  };

  const rewardSummary = () => {
    if (caseData.recompensa !== 'SI') {
      return 'No';
    }
    if (caseData.rewardAmount) {
      return caseData.rewardAmount;
    }
    return 'Monto no confirmado';
  };

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827').text('Legajo del caso');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(16).fillColor('#2563eb').text(displayName);
  doc.moveDown(0.4);

  // Incluir foto principal si existe
  if (primaryPhoto) {
    try {
      const photoPath = path.join(uploadsStaticPath, primaryPhoto.url.replace('/uploads/', ''));
      const imageBuffer = await fs.readFile(photoPath);

      // Calcular dimensiones para la imagen (max ancho de 200px, manteniendo proporción)
      const maxImageWidth = 200;
      const maxImageHeight = 250;

      // Centrar la imagen horizontalmente
      const imageX = (width - maxImageWidth) / 2;

      doc.image(imageBuffer, imageX, doc.y, {
        fit: [maxImageWidth, maxImageHeight],
        align: 'center'
      });

      // Mover el cursor después de la imagen
      doc.moveDown(12);

      // Agregar descripción de la foto si existe
      if (primaryPhoto.description) {
        doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
        doc.text(primaryPhoto.description, {
          width: contentWidth,
          align: 'center'
        });
        doc.moveDown(0.5);
      }
    } catch (error) {
      console.error('Error al incluir foto en PDF:', error);
      // Continuar sin la imagen si hay error
    }
  }

  drawDivider();

  drawSection('Resumen del caso', [
    { label: 'Estado', value: translateEstadoLabel(caseData.estadoRequerimiento) },
    { label: 'Fuerza asignada', value: caseData.fuerzaAsignada ?? 'S/D' },
    { label: 'Expediente', value: caseData.numeroCausa ?? '—' },
    { label: 'Jurisdicción', value: formatEnum(caseData.jurisdiccion) }
  ]);

  if (caseData.persona) {
    const persona = caseData.persona;
    const phones = [persona.phone, ...(persona.phones ?? []).map((entry) => entry.value)]
      .filter(Boolean)
      .join(' · ');
    const emails = [persona.email, ...(persona.emails ?? []).map((entry) => entry.value)]
      .filter(Boolean)
      .join(' · ');

    drawSection('Datos personales', [
      { label: 'Documento', value: persona.identityNumber ?? undefined },
      { label: 'Sexo', value: persona.sex ?? undefined },
      { label: 'Fecha de nacimiento', value: formatDate(persona.birthdate ?? null) },
      { label: 'Edad', value: persona.age ? `${persona.age} años` : undefined },
      { label: 'Domicilio', value: summarizeAllAddresses(persona) },
      { label: 'Teléfonos', value: phones || null },
      { label: 'Emails', value: emails || null },
      { label: 'Notas', value: persona.notes ?? undefined }
    ]);

    const contactLines: string[] = [];
    if (phones) contactLines.push(`Teléfonos: ${phones}`);
    if (emails) contactLines.push(`Emails: ${emails}`);
    const networks = (persona.socialNetworks ?? [])
      .map((entry) => `${entry.network}: ${entry.handle}`)
      .join(' · ');
    if (networks) contactLines.push(`Redes: ${networks}`);
    drawListSection('Contactos', contactLines);
  }

  drawSection('Información del caso', [
    { label: 'Carátula', value: caseData.caratula ?? undefined },
    { label: 'Delito', value: caseData.delito ?? undefined },
    { label: 'Juzgado', value: caseData.juzgadoInterventor ?? undefined },
    { label: 'Fiscalía', value: caseData.fiscalia ?? undefined },
    { label: 'Secretaría', value: caseData.secretaria ?? undefined },
    { label: 'Recompensa', value: rewardSummary() }
  ]);

  if (caseData.additionalInfo.length > 0) {
    drawAdditionalInfoSection('Información complementaria', caseData.additionalInfo);
  }

  doc.moveDown(0.6);
  doc.font('Helvetica').fontSize(10).fillColor('#6b7280');
  doc.text(`Creado: ${new Date(caseData.creadoEn).toLocaleString()}`);
  doc.text(`Actualizado: ${new Date(caseData.actualizadoEn).toLocaleString()}`);

  doc.end();

  const buffer = await bufferPromise;
  return { buffer, fileName };
};

export const exportCasesToExcel = async (ids: string[]) => {
  const records = await prisma.case.findMany({
    where: { id: { in: ids } },
    orderBy: { creadoEn: 'desc' },
    include: caseInclude
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Casos');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Estado', key: 'estado', width: 18 },
    { header: 'Fuerza', key: 'fuerza', width: 20 },
    { header: 'Expediente', key: 'expediente', width: 20 },
    { header: 'Jurisdicción', key: 'jurisdiccion', width: 18 },
    { header: 'Carátula', key: 'caratula', width: 25 },
    { header: 'Delito', key: 'delito', width: 25 },
    { header: 'Recompensa', key: 'recompensa', width: 15 },
    { header: 'Monto recompensa', key: 'monto', width: 18 },
    { header: 'Creado', key: 'creado', width: 22 },
    { header: 'Actualizado', key: 'actualizado', width: 22 },
    { header: 'Nombre', key: 'nombre', width: 25 },
    { header: 'Documento', key: 'documento', width: 22 },
    { header: 'Sexo', key: 'sexo', width: 12 },
    { header: 'Nacimiento', key: 'nacimiento', width: 18 },
    { header: 'Edad', key: 'edad', width: 8 },
    { header: 'Domicilio', key: 'domicilio', width: 30 },
    { header: 'Teléfonos', key: 'telefonos', width: 30 },
    { header: 'Emails', key: 'emails', width: 30 },
    { header: 'Notas', key: 'notas', width: 40 },
    { header: 'Información complementaria', key: 'info', width: 45 }
  ];

  records.forEach((record) => {
    const serialized = serializeCase(record);
    const persona = serialized.persona;
    const phones = [persona?.phone, ...(persona?.phones ?? []).map((entry) => entry.value)]
      .filter(Boolean)
      .join(' | ');
    const emails = [persona?.email, ...(persona?.emails ?? []).map((entry) => entry.value)]
      .filter(Boolean)
      .join(' | ');
    const info = serialized.additionalInfo.map((entry) => `${entry.label}: ${entry.value}`).join(' | ');

    const rewardAmountCell = serialized.recompensa === 'SI'
      ? serialized.rewardAmount ?? 'Monto no confirmado'
      : '—';

    sheet.addRow({
      id: serialized.id,
      estado: translateEstadoLabel(serialized.estadoRequerimiento),
      fuerza: serialized.fuerzaAsignada ?? 'S/D',
      expediente: serialized.numeroCausa ?? '—',
      jurisdiccion: formatEnum(serialized.jurisdiccion),
      caratula: serialized.caratula ?? '—',
      delito: serialized.delito ?? '—',
      recompensa: serialized.recompensa,
      monto: rewardAmountCell,
      creado: new Date(serialized.creadoEn).toLocaleString(),
      actualizado: new Date(serialized.actualizadoEn).toLocaleString(),
      nombre: persona ? `${persona.firstName} ${persona.lastName}`.trim() : '—',
      documento: persona?.identityNumber ?? '—',
      sexo: persona?.sex ?? '—',
      nacimiento: persona?.birthdate ? new Date(persona.birthdate).toLocaleDateString() : '—',
      edad: persona?.age ?? (persona?.birthdate ? computeAge(new Date(persona.birthdate)) : '—'),
      domicilio: summarizeAllAddresses(persona) ?? '—',
      telefonos: phones || '—',
      emails: emails || '—',
      notas: persona?.notes ?? '—',
      info: info || '—'
    });
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return Buffer.from(buffer);
};

export const generateCaseZip = async (id: string) => {
  const caseRecord = await prisma.case.findUnique({ where: { id }, include: caseInclude });
  if (!caseRecord) {
    throw new AppError('Caso no encontrado', 404, true);
  }

  const serialized = serializeCase(caseRecord);
  const persona = serialized.persona;
  const fullName = [persona?.firstName, persona?.lastName].filter(Boolean).join(' ').trim();

  const rootFolder = buildCaseFileBaseName(fullName);
  const zipFileName = buildCaseZipFileName(fullName);

  const [pdfResult, excelBuffer] = await Promise.all([
    generateCasePdf(id),
    exportCasesToExcel([id])
  ]);

  const { buffer: pdfBuffer, fileName: pdfFileName } = pdfResult;
  const excelFileName = buildCaseExcelFileName(fullName);

  const archive = archiver('zip', { zlib: { level: 9 } });
  const output = new PassThrough();
  const chunks: Buffer[] = [];

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  const usedEntries = new Set<string>();
  const reserveEntry = (entryPath: string) => {
    let candidate = entryPath;
    let suffix = 1;

    const lastSlash = entryPath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? entryPath.slice(0, lastSlash) : '';
    const fileName = lastSlash >= 0 ? entryPath.slice(lastSlash + 1) : entryPath;
    const extIndex = fileName.lastIndexOf('.');
    const base = extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
    const ext = extIndex > 0 ? fileName.slice(extIndex) : '';

    while (usedEntries.has(candidate)) {
      const nextName = `${base}_${suffix}${ext}`;
      candidate = dir ? `${dir}/${nextName}` : nextName;
      suffix += 1;
    }

    usedEntries.add(candidate);
    return candidate;
  };

  const appendUnderRoot = (relativePath: string, data: Buffer) => {
    const normalized = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const withRoot = `${rootFolder}/${normalized}`;
    const reserved = reserveEntry(withRoot);
    archive.append(data, { name: reserved });
  };

  const sanitizeEntryComponent = (value: string) => {
    const normalized = removeDiacritics(value);
    const trimmed = normalized.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return trimmed.slice(0, 150);
  };

  const resolveExtension = (originalName?: string | null, mimeType?: string | null) => {
    const ext = originalName ? path.extname(originalName) : '';
    if (ext) {
      return ext.toLowerCase();
    }
    if (mimeType) {
      const mapped = MIME_EXTENSION_MAP[mimeType];
      if (mapped) {
        return mapped;
      }
    }
    return '';
  };

  appendUnderRoot(pdfFileName, pdfBuffer);
  appendUnderRoot(excelFileName, excelBuffer);

  const mediaItems = caseRecord.media;

  const appendMediaGroup = async (items: typeof mediaItems, kind: CaseMediaKind, folderLabel: string) => {
    const filtered = items.filter((media) => media.kind === kind);
    let counter = 1;

    for (const media of filtered) {
      const absolutePath = path.join(uploadsStaticPath, media.filePath);
      let fileBuffer: Buffer;
      try {
        fileBuffer = await fs.readFile(absolutePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          continue;
        }
        throw error;
      }

      const extension = resolveExtension(media.originalName, media.mimeType) || '.bin';
      const fallbackName = `${folderLabel.toLowerCase()}_${String(counter).padStart(3, '0')}${extension}`;
      const originalName = media.originalName ? sanitizeEntryComponent(media.originalName) : '';
      const fileName = originalName || fallbackName;
      appendUnderRoot(`${folderLabel}/${fileName}`, fileBuffer);
      counter += 1;
    }
  };

  await appendMediaGroup(mediaItems, CaseMediaKind.PHOTO, 'FOTOS');
  await appendMediaGroup(mediaItems, CaseMediaKind.DOCUMENT, 'DOCUMENTOS');

  await archive.finalize();
  const buffer = await bufferPromise;

  return { buffer, fileName: zipFileName };
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
        estadoRequerimiento: input.estadoRequerimiento,
        fuerzaAsignada: input.fuerzaAsignada,
        recompensa: input.recompensa,
        rewardAmount:
          input.recompensa === 'SI' && input.rewardAmount
            ? new Prisma.Decimal(input.rewardAmount)
            : null,
        priorityValue: input.priorityValue,
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
        priorityValue: input.priorityValue !== undefined ? input.priorityValue : undefined,
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

export const generateAllCasesZip = async (estado?: string) => {
  const estadoFilter = estado && estado !== 'TODOS' ? estado : null;
  console.log(`Iniciando generación de ZIP ${estadoFilter ? `con estado ${estadoFilter}` : 'con todos los casos'}...`);

  // Construir el filtro donde
  const whereClause: any = {};
  if (estadoFilter) {
    whereClause.estadoRequerimiento = estadoFilter;
  }

  // Obtener los casos filtrados
  const allCases = await prisma.case.findMany({
    where: whereClause,
    include: caseInclude,
    orderBy: { creadoEn: 'desc' }
  });

  if (allCases.length === 0) {
    const message = estadoFilter
      ? `No hay casos con estado ${estadoFilter} para descargar`
      : 'No hay casos para descargar';
    throw new AppError(message, 404, true);
  }

  console.log(`Generando ZIP para ${allCases.length} casos${estadoFilter ? ` con estado ${estadoFilter}` : ''}...`);

  // Crear el archivo ZIP maestro
  const masterArchive = archiver('zip', { zlib: { level: 5 } }); // Nivel medio de compresión para mejor rendimiento
  const output = new PassThrough();
  const chunks: Buffer[] = [];

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    output.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
    masterArchive.on('error', reject);
  });

  masterArchive.pipe(output);

  // Procesar cada caso y agregarlo al ZIP maestro
  let processedCount = 0;

  for (const caseRecord of allCases) {
    try {
      // Generar el ZIP individual del caso directamente usando el ID
      console.log(`Procesando caso ${processedCount + 1}/${allCases.length}: ID ${caseRecord.id}`);
      const { buffer: caseZipBuffer, fileName: caseZipFileName } = await generateCaseZip(caseRecord.id);

      // Agregar el ZIP individual al archivo maestro
      masterArchive.append(caseZipBuffer, { name: caseZipFileName });

      processedCount++;
    } catch (error) {
      console.error(`Error procesando caso ${caseRecord.id}:`, error);
      // Continuar con el siguiente caso si hay un error
    }
  }

  await masterArchive.finalize();
  const buffer = await bufferPromise;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const estadoSuffix = estadoFilter ? `_${estadoFilter}` : '_TODOS';
  const fileName = `CASOS${estadoSuffix}_${timestamp}.zip`;

  console.log(`ZIP maestro generado exitosamente: ${fileName} (${processedCount} casos procesados)`);

  return { buffer, fileName, casesProcessed: processedCount, totalCases: allCases.length };
};
