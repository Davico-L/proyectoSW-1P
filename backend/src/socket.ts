import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getDiagramById } from "./services/diagramService";

export const initSocket = (server: HttpServer): Server => {
  const allowedOrigins = [
    "http://localhost:3001",
    "http://localhost:3000",
  ];

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.includes(origin) ||
          origin.startsWith("http://localhost:")
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Cliente conectado: ${socket.id}`);

    // Evento join-diagram: unirse a la sala del diagrama y enviar estado actual desde Postgres
    socket.on("join-diagram", async (payload: { diagramId: string }) => {
      try {
        const diagramId = payload?.diagramId;
        if (!diagramId || typeof diagramId !== "string") {
          return;
        }

        socket.join(diagramId);
        console.log(`[Socket] Socket ${socket.id} se unió a la sala: ${diagramId}`);

        // Consultar en Postgres usando la misma función de GET /diagrams/:id
        const diagram = await getDiagramById(diagramId);
        if (diagram) {
          // Emitir de vuelta exclusivamente a ese socket solo los elements
          const elements = diagram.data?.elements || [];
          socket.emit("diagram-state", { elements });
        }
      } catch (err: any) {
        console.error(
          `[Socket] Error al procesar join-diagram para ${payload?.diagramId}:`,
          err?.message || err
        );
      }
    });

    // Evento leave-diagram: abandonar la sala del diagrama indicado
    socket.on("leave-diagram", (payload: { diagramId: string }) => {
      const diagramId = payload?.diagramId;
      if (diagramId && typeof diagramId === "string") {
        socket.leave(diagramId);
        console.log(`[Socket] Socket ${socket.id} salió de la sala: ${diagramId}`);
      }
    });

    // Evento diagram-update: reenviar solo elements a todos en la sala EXCEPTO al emisor (sin tocar Postgres)
    socket.on(
      "diagram-update",
      (payload: { diagramId: string; elements?: any; data?: any }) => {
        try {
          const { diagramId } = payload || {};
          if (!diagramId) {
            return;
          }

          const elements =
            payload.elements !== undefined
              ? payload.elements
              : payload.data?.elements || payload.data;

          socket.to(diagramId).emit("diagram-update", { elements });
        } catch (err: any) {
          console.error(
            `[Socket] Error al reenviar diagram-update para ${payload?.diagramId}:`,
            err?.message || err
          );
        }
      }
    );

    socket.on("disconnect", (reason) => {
      console.log(`[Socket] Cliente desconectado (${socket.id}): ${reason}`);
    });
  });

  return io;
};
