import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { hashPassword } from '../../utils/password';
import { CreateUserInput, ResetPasswordInput, UpdateUserInput } from './users.schemas';

export const listUsers = () => {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true
    }
  });
};

export const createUser = async (payload: CreateUserInput) => {
  const email = payload.email.trim().toLowerCase();

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError('El email ya está registrado', 409, true);
  }

  const passwordHash = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email,
      passwordHash,
      role: payload.role
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  return user;
};

export const updateUser = async (id: string, payload: UpdateUserInput) => {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...payload,
        email: undefined
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true
      }
    });
    return user;
  } catch (error) {
    throw new AppError('Usuario no encontrado', 404, true);
  }
};

export const resetPassword = async (id: string, payload: ResetPasswordInput) => {
  const passwordHash = await hashPassword(payload.newPassword);
  try {
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });
  } catch (error) {
    throw new AppError('Usuario no encontrado', 404, true);
  }
};

export const deleteUser = async (id: string, currentUserId: string) => {
  if (id === currentUserId) {
    throw new AppError('No puedes eliminar tu propia cuenta', 400, true);
  }

  try {
    await prisma.user.delete({
      where: { id }
    });
  } catch (error) {
    throw new AppError('Usuario no encontrado', 404, true);
  }
};
