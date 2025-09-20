import { prisma } from '../../config/prisma';
import { AppError } from '../../errors/AppError';
import { generateAccessToken } from '../../utils/token';
import { verifyPassword, hashPassword } from '../../utils/password';
import { ChangePasswordInput, LoginInput } from './auth.schemas';

export const login = async ({ email, password }: LoginInput) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user || !user.isActive) {
    throw new AppError('Credenciales inválidas', 401, true);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Credenciales inválidas', 401, true);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role });
  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    }
  };
};

export const changePassword = async (userId: string, { currentPassword, newPassword }: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Usuario no encontrado', 404, true);
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError('Contraseña actual incorrecta', 400, true);
  }

  if (currentPassword === newPassword) {
    throw new AppError('La nueva contraseña debe ser distinta', 400, true);
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
};
