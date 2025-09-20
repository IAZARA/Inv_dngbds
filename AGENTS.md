# Repository Guidelines

## Project Structure & Module Organization
- `backend/` contiene la API Express escrita en TypeScript; agrupa lógica de dominio en `src/modules/{auth,cases,persons,sources,users}` y configura middleware y utilidades en `src/{middleware,config,utils}`.
- `backend/prisma/` mantiene el esquema de base de datos y migraciones; ajusta el seed en `prisma/seed.ts` antes de tocar datos.
- `frontend/` es un cliente React con Vite. Componentes compartidos viven en `src/components`, las páginas en `src/pages`, y el estado global en `src/context`.
- Archivos de despliegue (`Dockerfile`, `docker-compose.yml`) y artefactos (`dist/`, `public/`) se generan automáticamente; no los edites a mano.

## Build, Test, and Development Commands
- Backend: `cd backend && npm install` la primera vez. Usa `npm run dev` para un servidor con recarga y `npm run build && npm start` para producción. Ejecuta `npm run prisma:migrate` tras actualizar el esquema y `npm run db:seed` para poblar datos locales.
- Frontend: `cd frontend && npm install`, luego `npm run dev` para desarrollo, `npm run build` para generar `dist/`, y `npm run preview` para validar la build. Ejecuta `npm run lint` antes de subir cambios de UI.

## Coding Style & Naming Conventions
- TypeScript estricto en ambos proyectos; evita `any` sin justificar. Mantén imports ordenados por origen y usa funciones flecha para componentes.
- Sigue indentación de dos espacios y nombres en camelCase para funciones/variables; usa PascalCase para componentes React y clases Prisma.
- Respeta `.env` cargado vía `backend/src/config/env.ts`; define nuevas variables como `INVESTIGACION_*` y documenta su uso.

## Testing Guidelines
- Aún no hay suites automatizadas. Agrega pruebas unitarias e integraciones antes de features relevantes (`backend/src/__tests__`, `frontend/src/__tests__`). Incluye un plan manual breve en la PR hasta contar con cobertura >60%.
- Para endpoints nuevos, valida con Prisma SQLite/PostgreSQL local y comparte consultas o scripts usados en la PR.

## Commit & Pull Request Guidelines
- Historial actual usa español descriptivo con resumen breve (`Recurso: acción realizada`). Conserva esa voz en modo imperativo y <=72 caracteres.
- En la PR: describe el propósito, enlaza issue de seguimiento, lista validaciones (lint, build, migraciones) y adjunta capturas de UI cuando aplique.
- No mezcles cambios de frontend y backend en una sola PR a menos que sean inseparables; etiqueta a revisores del módulo impactado.

## Environment & Security Tips
- Copia `.env.example` cuando esté disponible; nunca subas `.env`. Usa `docker-compose up` para levantar stack completo y probar autenticación.
- Revoca tokens JWT de prueba y resetea la base con `npx prisma migrate reset` antes de compartir capturas o dumps.
