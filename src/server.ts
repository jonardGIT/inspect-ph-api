import app, { validateAppStartup } from "./app.js";
import { runNotificationDelivery } from "./scripts/run-notification-delivery.js";
import { runStatusSweep } from "./scripts/run-status-sweep.js";

const env = validateAppStartup();

const port = env.port;

// Run status sweep every 15 minutes
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
setInterval(() => {
  runStatusSweep().catch((err) => {
    console.error("Scheduled status sweep failed:", err);
  });
}, SWEEP_INTERVAL_MS);

// Deliver pending push notifications every 30 seconds
const DELIVERY_INTERVAL_MS = 30 * 1000;
setInterval(() => {
  runNotificationDelivery().catch((err) => {
    console.error("Scheduled notification delivery failed:", err);
  });
}, DELIVERY_INTERVAL_MS);

app.listen(port, () => {
  console.log(`inspect-ph-api listening on port ${port}`);
});
