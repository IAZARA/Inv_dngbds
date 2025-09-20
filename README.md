# InvestigacionDNGBDS

Aplicación full stack para gestionar investigaciones, consolidar información de múltiples fuentes y controlar acceso mediante roles.

## Estructura

- `backend/`: API REST en Node.js + Express + Prisma sobre PostgreSQL.
- `frontend/`: SPA en React (Vite) con React Router y React Query.
- `docker-compose.yml`: orquesta base de datos, backend y frontend para desarrollo rápido.
  - Casos/expedientes: tablas `cases`, `person_cases`, `person_case_offenses`, domicilios (`addresses`, `person_addresses`).

## Requisitos

- Node.js 20+
- PostgreSQL 15+ (o Docker)
- npm 10+

## Puesta en marcha rápida con Docker

```bash
# Iniciar servicios
docker compose up --build
```

Servicios expuestos:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000/api
- PostgreSQL: localhost:5432 (`investigacion_user` / `investigacion_pass`)

### Variables de entorno usadas en Docker

El backend toma `DATABASE_URL`, `JWT_SECRET` y `PORT` desde `docker-compose.yml`. Ajusta los valores según tu entorno.

## Configuración manual (sin Docker)

1. **Base de datos**: crea una instancia PostgreSQL y ajusta la cadena en `backend/.env` (ver `.env.example`).
2. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma generate
   npm run prisma:migrate # requiere DB disponible
   npm run db:seed        # crea usuario ADMIN inicial
   npm run dev
   ```
3. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run dev
   ```

El frontend espera acceder al backend en `VITE_API_BASE_URL` (por defecto `http://localhost:4000/api`).

## Autenticación y roles

- **ADMIN**: administra usuarios, crea/edita legajos y fuentes.
- **OPERATOR**: crea/actualiza legajos y carga fuentes.
- **CONSULTANT**: acceso de solo lectura a legajos y fuentes.

No existe registro público; los administradores crean cuentas y definen contraseñas temporales. El flujo recomendado es que el usuario cambie su contraseña desde `/api/auth/change-password` tras el primer ingreso.

## Endpoints principales (backend)

- `POST /api/auth/login`: autenticación (mail + contraseña).
- `POST /api/auth/change-password`: cambio de contraseña para usuarios autenticados.
- `GET /api/users/me`: datos del usuario actual.
- Rutas administrativas (`ADMIN`):
  - `GET/POST /api/users`
  - `PATCH /api/users/:id`
  - `POST /api/users/:id/reset-password`
- Legajos (`ADMIN` y `OPERATOR` escritura; todos lectura):
  - `GET/POST /api/persons`
  - `GET/PATCH /api/persons/:id`
  - `POST /api/persons/:id/sources`
- Fuentes (`ADMIN`/`OPERATOR` escritura; todos lectura): `GET/POST/PATCH /api/sources`
- Casos (`ADMIN`/`OPERATOR` escritura; todos lectura):
  - `GET /api/cases`
  - `GET /api/cases/:id`
  - `POST /api/cases`
  - `PATCH /api/cases/:id`
  - `DELETE /api/cases/:id`
  - Cada alta de caso crea o actualiza en el mismo paso la persona asociada (datos básicos, domicilios y delitos).

## Base de datos

- Prisma gestiona el esquema (ver `backend/prisma/schema.prisma`).
- Migración inicial en `backend/prisma/migrations/20240326000000_init`.
- Script de seed (`backend/prisma/seed.ts`) crea un usuario ADMIN con credenciales definidas en `.env` (`SEED_ADMIN_*`).

## Scripts útiles

### Backend

- `npm run dev`: API con recarga.
- `npm run build` / `npm start`: build y ejecución productiva.
- `npm run prisma:migrate`: aplica migraciones en desarrollo.
- `npm run db:seed`: ejecuta el seed inicial.

### Frontend

- `npm run dev`: servidor Vite.
- `npm run build`: build de producción.
- `npm run preview`: vista previa del build.

## Seguridad

- Contraseñas hasheadas con bcrypt.
- JWT con expiración de 15 minutos (ajustable en `generateAccessToken`).
- Middleware de autorización para proteger rutas y validar roles.

## Próximos pasos sugeridos

- Habilitar refresh tokens / rotación de sesión.
- Registrar auditoría detallada de acciones sobre legajos y fuentes.
- Añadir tests automatizados (Jest para backend, Vitest/Playwright para frontend).
- Integrar almacenamiento de archivos si se requieren documentos adjuntos en las investigaciones.
