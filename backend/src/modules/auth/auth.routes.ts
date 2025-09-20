import { Router } from 'express';
import { changePasswordHandler, loginHandler } from './auth.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.post('/login', loginHandler);
router.post('/change-password', requireAuth, changePasswordHandler);

export const authRouter = router;
