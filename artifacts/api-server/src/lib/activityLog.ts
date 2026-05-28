import { db, activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";

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
  try {
    await db.insert(activityLogTable).values({ ip, username, action, detail });
  } catch (err) {
    console.error("[activityLog] DB insert failed:", err);
  }
}

export async function getLog(): Promise<ActivityEntry[]> {
  try {
    const rows = await db
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
    console.error("[activityLog] DB select failed:", err);
    return [];
  }
}
