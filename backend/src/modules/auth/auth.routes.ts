import { Router } from 'express';
import { changePasswordHandler, loginHandler, refreshHandler } from './auth.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.post('/login', loginHandler);
router.post('/change-password', requireAuth, changePasswordHandler);
router.post('/refresh', requireAuth, refreshHandler);

export const authRouter = router;
