import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

// Default to 3000 for GCP AI Studio and single-process production deployment
const rawPort = process.env["PORT"] ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Cloud Run / Railway send SIGTERM before killing the container on redeploy
// or scale-in. Stop accepting new connections, let in-flight requests (git
// clone/commit, file writes) finish, then close the DB pool — otherwise a
// redeploy landing mid-operation can corrupt a project's .git index or leave
// a partially-written file.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down gracefully");

  const forceExitTimer = setTimeout(() => {
    logger.warn("Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close(async () => {
    await pool.end().catch((err) => logger.error({ err }, "Error closing DB pool"));
    clearTimeout(forceExitTimer);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
