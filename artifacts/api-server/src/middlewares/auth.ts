import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    logger.warn({ url: req.url }, "requireAuth: missing bearer token");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; username: string };
    (req as any).userId = payload.userId;
    (req as any).userEmail = payload.email;
    (req as any).username = payload.username;
    next();
  } catch {
    logger.warn({ url: req.url }, "requireAuth: invalid token");
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}
