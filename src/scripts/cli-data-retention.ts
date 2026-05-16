import { loadEnv } from "../lib/env.js";
import { runDataRetention } from "./run-data-retention.js";

async function main() {
  const env = loadEnv();

  console.log(
    `Running data retention (audit logs: ${env.auditLogRetentionDays}d, notifications: ${env.notificationRetentionDays}d)…`,
  );

  const result = await runDataRetention({
    auditLogRetentionDays: env.auditLogRetentionDays,
    notificationRetentionDays: env.notificationRetentionDays,
  });

  console.log(
    `Done: ${result.auditLogsDeleted} audit logs, ${result.notificationsDeleted} notifications, ` +
      `${result.attachmentMetadataDeleted} attachment records, ${result.inspectionsDeleted} inspections deleted; ` +
      `${result.issueReportsAnonymized} issue reports anonymized`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Data retention failed:", err);
  process.exit(1);
});
