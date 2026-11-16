import type { Database } from "firebase-admin/database";
import { isRoomCode } from "@/lib/session/room";
import { closeRooms } from "./closeRooms";
import { deleteRooms } from "./deleteRooms";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A room nobody has played in for this long is deleted (`lastActive`, else its creation). */
export const IDLE_DAYS = 30;
/** A room /admin closed is deleted this long after its closing. */
export const CLOSED_DAYS = 7;
/** At most this many rooms a run, so one run stays well inside the function's time limit; the rest go the next day. */
export const MAX_PER_RUN = 300;

const time = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined);

/**
 * The codes of the rooms due for cleanup in the `games` tree, oldest first:
 * closed CLOSED_DAYS+ ago, or idle IDLE_DAYS+ (`lastActive`, refreshed while a
 * game is in progress, else `meta.createdAt`). A room with neither date is
 * left alone. Pure, so it can be tested.
 */
export function roomsToClean(games: unknown, now: number): string[] {
  if (!games || typeof games !== "object") return [];
  const due: { code: string; since: number }[] = [];
  for (const [code, raw] of Object.entries(games as Record<string, unknown>)) {
    if (!isRoomCode(code) || !raw || typeof raw !== "object") continue;
    const room = raw as { meta?: { createdAt?: unknown }; lastActive?: unknown; closedAt?: unknown };
    if (!room.meta) continue;
    const closedAt = time(room.closedAt);
    const active = time(room.lastActive) ?? time(room.meta.createdAt);
    if (closedAt != null && closedAt <= now - CLOSED_DAYS * DAY_MS) due.push({ code, since: closedAt });
    else if (active != null && active <= now - IDLE_DAYS * DAY_MS) due.push({ code, since: active });
  }
  return due.sort((a, b) => a.since - b.since).map((room) => room.code);
}

export interface CleanupResult {
  /** Rooms deleted by this run. */
  deleted: string[];
  /** Rooms that were due, this run's included (more than MAX_PER_RUN leaves some for the next run). */
  due: number;
}

/**
 * The daily room cleanup (T-024; Vercel Cron calls app/api/cron/cleanup-rooms).
 * Rooms are never deleted otherwise, and "Your rooms" only hides them. Each
 * room due is closed (which also takes a public room out of the matchmaking
 * queue), then deleted the way /admin deletes one (`deleteRooms`): its summary
 * goes to `analytics/archive/{code}`, so the dashboard's history keeps it.
 */
export async function cleanupRooms(db: Database, now: number): Promise<CleanupResult> {
  const due = roomsToClean((await db.ref("games").get()).val(), now);
  const batch = due.slice(0, MAX_PER_RUN);
  if (!batch.length) return { deleted: [], due: 0 };
  await closeRooms(db, batch);
  const { deleted } = await deleteRooms(db, batch, now);
  return { deleted, due: due.length };
}
