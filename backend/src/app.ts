import express, { Application, Request, Response } from "express";
import cors from "cors";
import { healthRouter } from "./routes/healthRoutes";
import { sessionRouter } from "./routes/sessionRoutes";
import { diagramRouter } from "./routes/diagramRoutes";
import { authRouter } from "./routes/authRoutes";
import { helpRouter } from "./routes/helpRoutes";

export const app: Application = express();

// Configuración de CORS permitiendo peticiones desde http://localhost:3001
const allowedOrigins = [
  "http://localhost:3001",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin origin (como apps móviles, curl, o pruebas)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost:")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-session-id"],
  })
);

// Soporte para JSON con límite ampliado para diagramas complejos de Excalidraw
app.use(express.json({ limit: "50mb" }));

// Montaje de rutas
app.use("/health", healthRouter);
app.use("/session", sessionRouter);
app.use("/diagrams", diagramRouter);
app.use("/auth", authRouter);
app.use("/help", helpRouter);

// Ruta raíz informativa
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Backend API",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      session: "GET /session/:id (validación de sesión)",
      auth: {
        register: "POST /auth/register",
        login: "POST /auth/login",
      },
      diagrams: {
        create: "POST /diagrams",
        get: "GET /diagrams/:id",
        update: "PUT /diagrams/:id",
        list: "GET /diagrams?session_id=:sessionId",
      },
    },
  });
});

// Manejador para rutas no encontradas
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Ruta no encontrada." });
});
