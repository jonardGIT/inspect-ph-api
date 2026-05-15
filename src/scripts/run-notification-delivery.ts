/**
 * Expo Push Notification Delivery Worker
 *
 * Queries PENDING NotificationOutbox entries for recipients that have an
 * expoPushToken and delivers them via the Expo Push API.
 *
 * Run standalone:  npm run deliver:notifications
 * Called in-process from server.ts via runNotificationDelivery()
 */

import { prisma } from "../lib/prisma.js";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100;

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default";
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

async function sendExpoBatch(
  messages: ExpoMessage[],
): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_API, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo Push API responded with ${response.status}`);
  }

  const json = (await response.json()) as { data: ExpoPushTicket[] };
  return json.data;
}

export async function runNotificationDelivery(): Promise<void> {
  const entries = await prisma.notificationOutbox.findMany({
    where: {
      status: "PENDING",
      recipient: {
        expoPushToken: { not: null },
      },
    },
    include: {
      recipient: {
        select: {
          id: true,
          expoPushToken: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  if (entries.length === 0) {
    return;
  }

  const messages: ExpoMessage[] = entries.map((entry) => ({
    to: entry.recipient.expoPushToken as string,
    title: entry.title,
    body: entry.body,
    sound: "default",
    data: {
      ...(entry.entityType ? { entityType: entry.entityType } : {}),
      ...(entry.entityId ? { entityId: entry.entityId } : {}),
      eventType: entry.eventType,
    },
  }));

  let tickets: ExpoPushTicket[];

  try {
    tickets = await sendExpoBatch(messages);
  } catch (err) {
    // On a network failure, leave entries as PENDING for the next run
    console.error("Expo Push batch failed:", err);
    return;
  }

  // Update each entry based on the ticket result
  await Promise.all(
    entries.map(async (entry, index) => {
      const ticket = tickets[index];

      if (!ticket) {
        return;
      }

      const succeeded = ticket.status === "ok";

      await prisma.notificationOutbox.update({
        where: { id: entry.id },
        data: {
          status: succeeded ? "PROCESSED" : "FAILED",
          processedAt: succeeded ? new Date() : undefined,
          errorMessage: succeeded ? null : (ticket.message ?? "Unknown error"),
        },
      });
    }),
  );

  console.log(
    JSON.stringify({
      deliveredAt: new Date().toISOString(),
      total: entries.length,
      succeeded: tickets.filter((t) => t.status === "ok").length,
      failed: tickets.filter((t) => t.status !== "ok").length,
    }),
  );
}

async function main() {
  await runNotificationDelivery();
}

main()
  .catch((error) => {
    console.error("Notification delivery failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
