import { getDb, hasDb, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { logger } from "./logger";

export interface ActivityEntry {
  time: string;
  ip: string;
  username: string;
  action: string;
  detail?: string;
}

export async function logActivity(
  ip: string,
  username: string,
  action: string,
  detail?: string,
): Promise<void> {
  if (!hasDb()) {
    logger.warn("logActivity called but DATABASE_URL is not set — skipping");
    return;
  }
  try {
    await getDb().insert(activityLogTable).values({ ip, username, action, detail });
  } catch (err) {
    logger.error({ err, ip, username, action }, "[activityLog] DB insert failed");
  }
}

export async function getLog(): Promise<ActivityEntry[]> {
  if (!hasDb()) return [];
  try {
    const rows = await getDb()
      .select()
      .from(activityLogTable)
      .orderBy(desc(activityLogTable.time))
      .limit(1000);
    return rows.map((r) => ({
      time: r.time.toISOString(),
      ip: r.ip,
      username: r.username,
      action: r.action,
      detail: r.detail ?? undefined,
    }));
  } catch (err) {
    logger.error({ err }, "[activityLog] DB select failed");
    return [];
  }
}
