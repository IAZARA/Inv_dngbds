import { UserRole } from '@prisma/client';
import { z } from 'zod';

const nameSchema = z.string().min(2).max(100);

export const createUserSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole)
});

export const updateUserSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional()
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8)
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
