import bcrypt from 'bcrypt';
import { env } from '../config/env';

export const hashPassword = (plain: string) => bcrypt.hash(plain, env.bcryptSaltRounds);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
