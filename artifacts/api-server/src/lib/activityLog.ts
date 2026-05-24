export interface ActivityEntry {
  time: string;
  ip: string;
  username: string;
  action: string;
  detail?: string;
}

const entries: ActivityEntry[] = [];
const MAX_ENTRIES = 1000;

export function logActivity(
  ip: string,
  username: string,
  action: string,
  detail?: string,
) {
  entries.push({
    time: new Date().toISOString(),
    ip,
    username,
    action,
    detail,
  });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getLog(): ActivityEntry[] {
  return [...entries].reverse();
}
