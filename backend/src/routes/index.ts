import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { personsRouter } from '../modules/persons/persons.routes';
import { sourcesRouter } from '../modules/sources/sources.routes';
import { usersRouter } from '../modules/users/users.routes';
import { casesRouter } from '../modules/cases/cases.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/persons', personsRouter);
router.use('/sources', sourcesRouter);
router.use('/cases', casesRouter);

export const apiRouter = router;
