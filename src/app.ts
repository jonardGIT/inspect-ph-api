import "./env.js";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { loadEnv } from "./lib/env.js";
import { validateStartupEnv } from "./lib/startup-env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { createRateLimitMiddleware } from "./middleware/rate-limit.js";
import auditLogsRouter from "./routes/audit-logs.js";
import authRouter from "./routes/auth.js";
import businessesRouter from "./routes/businesses.js";
import fireSafetyCertificatesRouter from "./routes/fire-safety-certificates.js";
import healthRouter from "./routes/health.js";
import inspectionsRouter from "./routes/inspections.js";
import issueReportsRouter from "./routes/issue-reports.js";
import lgusRouter from "./routes/lgus.js";
import modulesRouter from "./routes/modules.js";
import notificationsOutboxRouter from "./routes/notifications-outbox.js";
import officeModulesRouter from "./routes/office-modules.js";
import officesRouter from "./routes/offices.js";
import paymentsRouter from "./routes/payments.js";
import permitsRouter from "./routes/permits.js";
import uploadsRouter from "./routes/uploads.js";

const app = express();
export const API_V1 = "/api/v1";

const publicEndpointRateLimiter = createRateLimitMiddleware({
  keyPrefix: "public",
  limit: 60,
  windowMs: 60_000,
});

export function validateAppStartup() {
  const env = loadEnv();
  validateStartupEnv(env);

  return env;
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get(API_V1, publicEndpointRateLimiter, (_req, res) => {
  res.json({ data: { service: "inspect-ph-api", status: "ok" } });
});

app.use(`${API_V1}/health`, publicEndpointRateLimiter, healthRouter);
app.use(`${API_V1}/auth`, authRouter);
app.use(`${API_V1}/audit-logs`, auditLogsRouter);
app.use(`${API_V1}/businesses`, businessesRouter);
app.use(`${API_V1}/fire-safety-certificates`, fireSafetyCertificatesRouter);
app.use(`${API_V1}/inspections`, inspectionsRouter);
app.use(`${API_V1}/issue-reports`, issueReportsRouter);
app.use(`${API_V1}/lgus`, lgusRouter);
app.use(`${API_V1}/modules`, modulesRouter);
app.use(`${API_V1}/notifications/outbox`, notificationsOutboxRouter);
app.use(`${API_V1}/office-modules`, officeModulesRouter);
app.use(`${API_V1}/offices`, officesRouter);
app.use(`${API_V1}/payments`, paymentsRouter);
app.use(`${API_V1}/permits`, permitsRouter);
app.use(`${API_V1}/uploads`, uploadsRouter);

app.use(notFoundHandler);

app.use(errorHandler);

export default app;
