import type { Role } from "@/lib/session/types";

export const GAME_TITLE = "Co-Counsel";

/** Roles are fixed for the whole case, not rotating per Part like First to Worst's master/guesser. */
export const INVESTIGATOR: Role = "p1";
export const DEFENDANT: Role = "p2";

/**
 * The miss that ends the case: misses count across the WHOLE case (not per
 * Part - a deliberate deviation from the original design doc's "2 attempts
 * per Part", per user request), and the case ends ON this miss, not after it
 * (the user's call, 2026-11-16, T-qkje). The count carries over between Parts,
 * so the ending miss can be the very first attempt of a later Part.
 */
export const MAX_CASE_ATTEMPTS = 3;
