import { Router, Request, Response } from "express";
import { checkDbConnection } from "../db";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const dbHealth = await checkDbConnection();

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.connected ? "connected" : "disconnected",
      latencyMs: dbHealth.latencyMs,
      ...(dbHealth.message && { message: dbHealth.message }),
    },
  });
});
