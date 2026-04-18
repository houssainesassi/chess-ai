import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    logger.warn({
      authUserId: auth?.userId ?? null,
      hasSessionId: !!auth?.sessionId,
      hasAuthHeader: !!(req.headers.authorization),
      cookieHeader: req.headers.cookie ?? "(none)",
      parsedCookieKeys: Object.keys(req.cookies ?? {}),
    }, "requireAuth: unauthorized request");
    res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    return;
  }
  (req as any).userId = userId as string;
  next();
}
