import { and, inArray } from "drizzle-orm";
import { db, pushDevicesTable } from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUsers(
  userIds: string[],
  notification: { title: string; body: string; data?: Record<string, string> },
) {
  if (!userIds.length) return;
  const devices = await db
    .select({ token: pushDevicesTable.token })
    .from(pushDevicesTable)
    .where(inArray(pushDevicesTable.userId, [...new Set(userIds)]));
  if (!devices.length) return;

  for (let offset = 0; offset < devices.length; offset += 100) {
    const batch = devices.slice(offset, offset + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map(({ token }) => ({
            to: token,
            sound: "default",
            title: notification.title,
            body: notification.body,
            data: notification.data ?? {},
            priority: "high",
            channelId: "marketplace-updates",
          })),
        ),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, "Expo push request failed");
        continue;
      }

      const result = (await response.json()) as {
        data?: Array<{ status?: string; details?: { error?: string } }>;
      };
      const invalidTokens = (result.data ?? [])
        .map((ticket, index) =>
          ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered"
            ? batch[index]?.token
            : null,
        )
        .filter((token): token is string => Boolean(token));
      if (invalidTokens.length) {
        await db
          .delete(pushDevicesTable)
          .where(and(inArray(pushDevicesTable.token, invalidTokens)));
      }
    } catch (error) {
      logger.warn({ err: error }, "Unable to send Expo push notification");
    }
  }
}
