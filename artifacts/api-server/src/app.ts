import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Single-process production mode: when the built frontend sits next to the
// server bundle (dist/public, copied in by the Docker build), serve it here
// with an SPA fallback — no separate web server needed.
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
  logger.info({ publicDir }, "Serving bundled frontend");
}

// JSON 404 for anything under /api that no route matched (falls through the
// static/SPA handlers above only for GET; other methods reach here directly).
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — every route in this API returns JSON, so an
// uncaught exception should too instead of falling through to Express's
// default HTML error page (which also leaks a stack trace outside
// production). Express 5 forwards rejected promises from async handlers
// here automatically.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : String(err instanceof Error ? err.message : err);
  res.status(500).json({ error: message });
});

export default app;
