import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { CreateSourceInput, UpdateSourceInput } from './sources.schemas';

export const listSources = () => {
  return prisma.source.findMany({ orderBy: { name: 'asc' } });
};

export const createSource = (payload: CreateSourceInput) => {
  return prisma.source.create({ data: payload });
};

export const updateSource = async (id: string, payload: UpdateSourceInput) => {
  try {
    return await prisma.source.update({ where: { id }, data: payload });
  } catch (error) {
    throw new AppError('Fuente no encontrada', 404, true);
  }
};
