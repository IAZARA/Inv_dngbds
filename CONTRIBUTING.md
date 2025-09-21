# Flujo de trabajo y despliegue

Esta guía resume cómo desarrollar cambios, validarlos y llevarlos a Railway.

## Preparación local

- Clona el repo y ejecuta `npm install` en `backend/` y `frontend/`.
- Copia las variables de entorno desde los `.env.example` si existen. Para el backend usa `backend/.env` con los valores locales.
- Levanta servicios locales con `npm run dev` en cada paquete o `docker-compose up` si querés la pila completa.

## Rutina de desarrollo

1. Creá una rama a partir de `master`: `git checkout -b recurso-cambio`.
2. Implementá los cambios por módulo (evitá mezclar backend y frontend salvo que sea imprescindible).
3. Ejecutá validaciones:
   - Backend: `npm run build` y adaptá migraciones si tocás la base (`npm run prisma:migrate`).
   - Frontend: `npm run build` y `npm run lint` para asegurar estilo.
4. Si agregás migraciones:
   - Asegurate de que cada archivo funcione secuencialmente (`prisma/migrations`).
   - Actualizá el seed (`prisma/seed.ts`) si los datos iniciales cambian. Probalo con `npm run db:seed`.
5. Ejecutá `npm run db:seed` sólo en entornos locales o usando `railway run npx prisma db seed` en producción.

## Commits y PRs

- Formato de commit: `Recurso: acción`, tono imperativo, máx 72 caracteres.
- Empujá la rama: `git push origin recurso-cambio`.
- Abrí la PR siguiendo la plantilla del repo: propósito, issue, validaciones (build, lint, migraciones), capturas cuando aplique.
- No mezcles cambios de frontend y backend a menos que sean inseparables.

## Despliegue en Railway

### Backend

1. Tras merge a `master`, redeployá el servicio.
2. El `Start Command` debe ser `npm run prisma:deploy && npm start` (ya configurado) para aplicar migraciones antes de arrancar.
3. Si cargaste nuevos datos seed:
   - Ejecutá `railway run npx prisma db seed` para poblarlos.
4. Variables obligatorias: `DATABASE_URL`, `JWT_SECRET`, `BCRYPT_SALT_ROUNDS`, `SEED_*` (opcional). Las define Railway en el servicio backend.

### Frontend

1. Redeployá el servicio. El `startCommand` en `frontend/railway.toml` ya expande `PORT` correctamente.
2. Definí `VITE_API_BASE_URL` apuntando al backend (sin `/api`, la app lo agrega). Ejemplo: `https://backend-production-e9f4.up.railway.app`.
3. Si necesitás hosts adicionales para preview, usa `PREVIEW_ALLOWED_HOSTS` (lista separada por comas).

### Verificación post-deploy

- Backend: `GET /health` debe devolver `{"status":"ok"}`.
- Frontend: comprobá login y flujo básico. Ante errores 500, revisá logs en Railway.

## Buenas prácticas adicionales

- No subas `.env` ni credenciales. Usa variables en Railway.
- Documentá manualmente pruebas realizadas cuando aún no hay tests automatizados.
- Antes de compartir credenciales o dumps, ejecutá `npx prisma migrate reset` para regenerar el esquema con datos de ejemplo.

Esta guía se mantiene viva; actualizala cuando cambie el proceso.
