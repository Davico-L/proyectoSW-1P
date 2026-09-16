# Backend - API Node.js + Express (TypeScript)

Servicio backend desarrollado con **Express** y **TypeScript**, estructurado para conectarse a **PostgreSQL** (compatible con proveedores serverless / nube como Neon y Supabase).

## Estructura del Proyecto

```text
backend/
├── src/
│   ├── db/              # Pool de conexión, migraciones y utilidades de Postgres
│   │   ├── index.ts
│   │   ├── init.sql     # Script SQL con esquemas de sessions y diagrams
│   │   └── migrate.ts   # Ejecutor de migraciones automáticas / CLI
│   ├── routes/          # Manejadores de endpoints HTTP
│   │   ├── healthRoutes.ts
│   │   ├── sessionRoutes.ts
│   │   └── diagramRoutes.ts
│   ├── services/        # Lógica de negocio y persistencia
│   │   ├── sessionService.ts
│   │   └── diagramService.ts
│   ├── app.ts           # Configuración de Express, CORS y middlewares
│   └── index.ts         # Punto de entrada y arranque del servidor
├── .env.example         # Plantilla de variables de entorno (Neon/Supabase)
├── package.json
└── tsconfig.json
```

## Modelo de Datos (PostgreSQL)

### Tabla `sessions`
- `id` (UUID, PK)
- `username` (VARCHAR(255))
- `created_at` (TIMESTAMP WITH TIME ZONE)

### Tabla `diagrams`
- `id` (UUID, PK, default `gen_random_uuid()`)
- `session_id` (UUID, FK `sessions(id)` ON DELETE CASCADE)
- `name` (VARCHAR(255))
- `data` (JSONB, almacena estado de Excalidraw: `elements`, `appState`, `files`)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

## Configuración y Migraciones

1. Configurar variables de entorno en `.env`:
```bash
cp .env.example .env
```
Configurar la variable `DATABASE_URL` con las credenciales de Supabase o Neon.

2. Ejecutar migración manual:
```bash
npm run migrate
```
*(El servidor también verifica e inicializa las tablas automáticamente al iniciar conexión).*

## Scripts Disponibles

```bash
# Modo desarrollo con recarga automática
npm run dev

# Ejecutar migraciones SQL
npm run migrate

# Compilar a JavaScript
npm run build

# Ejecutar producción
npm start

# Verificación de tipos TypeScript
npm run typecheck
```

## Endpoints

| Método | Ruta | Descripción | Payload |
|---|---|---|---|
| `GET` | `/health` | Estado del servidor y conectividad a Postgres | - |
| `POST` | `/session` | Creación de sesión ligera de usuario | `{"username": "juan"}` |
| `GET` | `/session/:id` | Consulta de datos de sesión activa | - |
| `POST` | `/diagrams` | Guarda un nuevo diagrama de Excalidraw | `{"session_id": "UUID", "name": "Mi Diagrama", "data": {"elements": [...], "appState": {...}}}` |
| `GET` | `/diagrams/:id` | Obtiene el estado guardado de un diagrama | - |
| `PUT` | `/diagrams/:id` | Actualiza los datos o nombre del diagrama | `{"data": {"elements": [...], "appState": {...}}, "name": "Opcional"}` |
| `GET` | `/diagrams?session_id=...` | Lista los diagramas asociados a una sesión | - |

## Configuración de CORS
CORS está configurado para admitir solicitudes desde `http://localhost:3001` (cliente web Excalidraw) y `http://localhost:3000`, permitiendo credenciales y los métodos `GET`, `POST`, `PUT`, `DELETE` y `OPTIONS`.
