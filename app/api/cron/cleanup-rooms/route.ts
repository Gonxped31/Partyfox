import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { cleanupRooms } from "@/lib/admin/cleanupRooms";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE } from "@/lib/admin/guard";
import { checkPassword } from "@/lib/admin/session";

export const maxDuration = 60;

/**
 * The daily room cleanup (`cleanupRooms`), called by Vercel Cron (`vercel.json`).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; the route refuses anything
 * else, and everything while `CRON_SECRET` is unset. Set it on Production only:
 * Preview deployments share the production database.
 */
export async function GET() {
  const auth = (await headers()).get("authorization") ?? "";
  // The same constant-time comparison as the admin password; always false while CRON_SECRET is unset.
  if (!auth.startsWith("Bearer ") || !checkPassword(process.env.CRON_SECRET || undefined, auth.slice("Bearer ".length))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401, headers: NO_STORE });
  }
  try {
    const result = await cleanupRooms(adminDb(), Date.now());
    console.log(`Room cleanup: deleted ${result.deleted.length} of ${result.due} rooms due`);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error("Room cleanup failed", error);
    const message = error instanceof AdminConfigError ? error.message : "The room cleanup failed.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
