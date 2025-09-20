import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { CasePersonInput, CreateCaseInput, UpdateCaseInput } from './cases.schemas';

const caseInclude = {
  personas: {
    include: {
      person: {
        include: {
          addresses: {
            include: {
              address: true
            }
          }
        }
      },
      offenses: true
    }
  }
} satisfies Prisma.CaseInclude;

type CaseWithRelations = Prisma.CaseGetPayload<{ include: typeof caseInclude }>;

const toISO = (value?: Date | null) => (value ? value.toISOString() : null);

const serializeCase = (record: CaseWithRelations) => {
  const persona = record.personas[0];
  return {
    id: record.id,
    numeroCausa: record.numeroCausa,
    fechaHecho: toISO(record.fechaHecho),
    estadoSituacion: record.estadoSituacion,
    fuerzaAsignada: record.fuerzaAsignada,
    reward: record.reward ?? null,
    creadoEn: record.creadoEn.toISOString(),
    actualizadoEn: record.actualizadoEn.toISOString(),
    persona: persona
      ? {
          id: persona.person.id,
          firstName: persona.person.firstName ?? '',
          lastName: persona.person.lastName ?? '',
          identityNumber: persona.person.identityNumber ?? null,
          birthdate: toISO(persona.person.birthdate),
          notes: persona.person.notes ?? null,
          nationality: persona.person.nationality,
          otherNationality: persona.person.otherNationality ?? null,
          addresses: persona.person.addresses.map((item) => ({
            id: item.addressId,
            addressText: item.address.addressText,
            principal: item.principal
          }))
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

const uniqueStrings = (values: string[] = []) =>
  Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));

const normalize = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const ensurePerson = async (
  tx: Prisma.TransactionClient,
  input: Partial<CasePersonInput>,
  fallbackPersonId?: string
) => {
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

  if (input.birthdate !== undefined) {
    updateData.birthdate = input.birthdate ? parseBirthdate(input.birthdate) : null;
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

  const created = await tx.person.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      identityNumber: normalize(input.identityNumber),
      birthdate: input.birthdate ? parseBirthdate(input.birthdate) : undefined,
      notes: normalize(input.notes),
      nationality: input.nationality ?? 'ARGENTINA',
      otherNationality: normalize(input.otherNationality)
    }
  });

  return created.id;
};

const syncPersonAddresses = async (
  tx: Prisma.TransactionClient,
  personId: string,
  addresses?: string[]
) => {
  if (!addresses) {
    return;
  }

  await tx.personAddress.deleteMany({ where: { personId } });

  const cleaned = uniqueStrings(addresses);
  for (const [index, addressText] of cleaned.entries()) {
    const existing = await tx.address.findFirst({ where: { addressText } });
    const address =
      existing ??
      (await tx.address.create({
        data: {
          addressText
        }
      }));

    await tx.personAddress.create({
      data: {
        personId,
        addressId: address.id,
        principal: index === 0
      }
    });
  }
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

    const created = await tx.case.create({
      data: {
        numeroCausa: normalize(input.numeroCausa),
        fechaHecho: buildFechaHecho(input.fechaHecho),
        estadoSituacion: input.estadoSituacion.trim(),
        fuerzaAsignada: input.fuerzaAsignada,
        reward: normalize(input.reward),
        personas: {
          create: {
            personId,
            rol: null
          }
        }
      },
      include: caseInclude
    });

    await syncPersonAddresses(tx, personId, input.persona.addresses);

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

    await tx.case.update({
      where: { id },
      data: {
        numeroCausa: input.numeroCausa !== undefined ? normalize(input.numeroCausa) : undefined,
        fechaHecho: input.fechaHecho !== undefined ? buildFechaHecho(input.fechaHecho) : undefined,
        estadoSituacion: input.estadoSituacion?.trim(),
        fuerzaAsignada: input.fuerzaAsignada,
        reward: input.reward !== undefined ? normalize(input.reward) : undefined
      }
    });

    if (input.persona) {
      const currentPersonId = existing.personas[0]?.person.id;
      const personId = await ensurePerson(tx, input.persona, currentPersonId);

      await attachPersonToCase(tx, id, personId);

      if (input.persona.addresses) {
        await syncPersonAddresses(tx, personId, input.persona.addresses);
      }
    }

    const updated = await tx.case.findUniqueOrThrow({ where: { id }, include: caseInclude });
    return serializeCase(updated);
  });
};

export const deleteCase = async (id: string) => {
  try {
    await prisma.case.delete({ where: { id } });
  } catch (error) {
    throw new AppError('Caso no encontrado', 404, true);
  }
};
