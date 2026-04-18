import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

function parseEnvVar(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const eqIndex = raw.indexOf("=");
  if (eqIndex > 0 && raw.slice(0, eqIndex) === raw.slice(0, eqIndex).toUpperCase()) {
    return raw.slice(eqIndex + 1) || undefined;
  }
  return raw;
}

const clerkSecretKey = parseEnvVar(process.env.CLERK_SECRET_KEY);
const clerkPublishableKey = parseEnvVar(process.env.VITE_CLERK_PUBLISHABLE_KEY) ?? parseEnvVar(process.env.CLERK_PUBLISHABLE_KEY);

logger.info({ hasSecretKey: !!clerkSecretKey, hasPublishableKey: !!clerkPublishableKey }, "Clerk config");

// Build authorized parties from Replit domains so Clerk accepts tokens
// issued by the frontend (azp claim carries the frontend origin)
const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const replitDomains = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .flatMap((d) => [`https://${d}`, `http://${d}`]);

const localOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
];

const authorizedParties: string[] = [
  ...replitDomains,
  ...(replitDevDomain
    ? [
        `https://${replitDevDomain}`,
        `https://${replitDevDomain}:3000`,
        `https://${replitDevDomain}:5173`,
        `https://${replitDevDomain}:21592`,
        `http://${replitDevDomain}`,
        `http://${replitDevDomain}:3000`,
        `http://${replitDevDomain}:5173`,
        `http://${replitDevDomain}:21592`,
      ]
    : localOrigins),
];

logger.info({ authorizedParties }, "Clerk authorized parties");

if (clerkSecretKey && clerkPublishableKey) {
  app.use(clerkMiddleware({
    publishableKey: clerkPublishableKey,
    secretKey: clerkSecretKey,
    ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
  }));
} else {
  logger.warn("Clerk keys not configured — running in unauthenticated local mode");
}

app.use("/api", router);

// Serve frontend static files in production
if (process.env.NODE_ENV === "production") {
  const currentDir = path.dirname(new URL(import.meta.url).pathname);
  const staticDir = path.resolve(currentDir, "../../chess-board/dist/public");
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.use((_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    logger.warn({ staticDir }, "Frontend static dir not found, skipping static serving");
  }
}

export default app;
