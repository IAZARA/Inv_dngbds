import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { CreatePersonInput, CreateSourceRecordInput, UpdatePersonInput } from './persons.schemas';

export const listPersons = () => {
  return prisma.person.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      identityNumber: true,
      firstName: true,
      lastName: true,
      birthdate: true,
      createdAt: true,
      updatedAt: true,
      records: {
        select: {
          id: true,
          summary: true,
          source: { select: { id: true, name: true, kind: true } },
          collectedAt: true
        },
        take: 5
      }
    }
  });
};

export const createPerson = (payload: CreatePersonInput) => {
  return prisma.person.create({ data: payload });
};

export const getPersonById = async (id: string) => {
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      records: {
        include: {
          source: true,
          collectedBy: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: { collectedAt: 'desc' }
      }
    }
  });

  if (!person) {
    throw new AppError('Persona no encontrada', 404, true);
  }

  return person;
};

export const updatePerson = async (id: string, payload: UpdatePersonInput) => {
  try {
    return await prisma.person.update({ where: { id }, data: payload });
  } catch (error) {
    throw new AppError('Persona no encontrada', 404, true);
  }
};

export const addSourceRecord = async (
  personId: string,
  userId: string,
  payload: CreateSourceRecordInput
) => {
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    throw new AppError('Persona no encontrada', 404, true);
  }

  const source = await prisma.source.findUnique({ where: { id: payload.sourceId } });
  if (!source) {
    throw new AppError('Fuente no encontrada', 404, true);
  }

  const collectedAt = payload.collectedAt ? new Date(payload.collectedAt) : undefined;
  const rawPayload =
    payload.rawPayload === undefined ? undefined : (payload.rawPayload as Prisma.InputJsonValue);

  return prisma.sourceRecord.create({
    data: {
      personId,
      sourceId: payload.sourceId,
      collectedById: userId,
      collectedAt,
      rawPayload,
      summary: payload.summary
    },
    include: {
      source: true
    }
  });
};
